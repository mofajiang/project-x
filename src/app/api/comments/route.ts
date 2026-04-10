import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getSiteConfig, type SiteConfig } from '@/lib/config'
import { runMigrations } from '@/lib/db-migrate'
import { sendNewCommentNotification } from '@/lib/mailer'
import { getClientIp } from '@/lib/request-ip'
import { analyzeCommentWithAI, quickSpamCheck } from '@/lib/openrouter-spam-filter'
import { revalidateTag } from 'next/cache'
import { rateLimit } from '@/lib/rate-limit'
import { getErrorMessage } from '@/lib/converters'
import { syslog } from '@/lib/syslog'
import { getPostUrl } from '@/lib/post-link'

const DEBUG = process.env.NODE_ENV === 'development'

export async function POST(req: NextRequest) {
  await runMigrations()

  // 评论频率限制：同一 IP 每分钟最多 5 条
  const clientIp = getClientIp(req)
  if (!rateLimit(`comment:${clientIp}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: '评论太频繁，请稍后再试' }, { status: 429 })
  }

  const session = await getSessionFromRequest(req)

  let { postId, content, parentId, guestName, guestEmail, guestWebsite } = await req.json()
  postId = String(postId) // 确保 postId 是字符串
  if (!postId || !content?.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
  if (content.trim().length > 2000) return NextResponse.json({ error: '评论不能超过2000字' }, { status: 400 })

  // 未登录时必须填昵称和邮箱
  if (!session) {
    const name = guestName?.trim()
    if (!name) return NextResponse.json({ error: '请填写昵称' }, { status: 400 })
    if (name.length > 20) return NextResponse.json({ error: '昵称不超过20字' }, { status: 400 })
    if (guestEmail?.trim()) {
      const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailReg.test(guestEmail.trim())) return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }
    if (guestWebsite?.trim()) {
      try {
        new URL(guestWebsite.trim())
      } catch {
        return NextResponse.json({ error: '网站地址格式不正确' }, { status: 400 })
      }
    }
  }

  const config = await getSiteConfig()
  const ip = getClientIp(req)

  // 进行本地快速垃圾检测（同步，<50ms）
  const quickCheck = quickSpamCheck(content.trim(), guestEmail)

  // 构建评论数据，兼容 guestName 列不存在的情况
  // 直接包含本地检测结果，避免额外的数据库更新
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentData: any = {
    content: content.trim(),
    postId,
    authorId: session?.userId || null,
    parentId: parentId || null,
    // 启用 AI 检测时，访客评论先挂起（false）等待 AI 异步分析后再决定最终状态
    // 避免评论「创建即通过」导致 AI 审核形同虚设
    approved: session ? true : config.enableAiDetection ? false : !config.commentApproval,
    ip,
    riskScore: quickCheck.localRiskScore,
    riskReasons: JSON.stringify(quickCheck.localRiskScore > 0 ? ['本地检查中...'] : []),
  }
  if (!session && guestName?.trim()) {
    commentData.guestName = guestName.trim()
  }
  if (!session && guestEmail?.trim()) {
    commentData.guestEmail = guestEmail.trim()
  }
  if (!session && guestWebsite?.trim()) {
    commentData.guestWebsite = guestWebsite.trim()
  }

  let comment
  try {
    comment = await prisma.comment.create({ data: commentData })
  } catch (e: unknown) {
    // guestName 列可能尚未迁移，降级去掉该字段重试
    if (
      getErrorMessage(e).includes('guestName') ||
      getErrorMessage(e).includes('guestEmail') ||
      getErrorMessage(e).includes('guestWebsite') ||
      getErrorMessage(e).includes('ip') ||
      getErrorMessage(e).includes('no such column')
    ) {
      delete commentData.guestName
      delete commentData.guestEmail
      delete commentData.guestWebsite
      delete commentData.ip
      comment = await prisma.comment.create({ data: commentData })
    } else {
      console.error('[comment create]', getErrorMessage(e))
      return NextResponse.json({ error: '评论提交失败，请重试' }, { status: 500 })
    }
  }

  // 立即返回响应（用户感受极快）⚡
  const responseData = { ok: true, comment }

  // 后台异步执行：AI 检测 + 邮件通知
  if (quickCheck.shouldAnalyze || config.enableAiDetection) {
    // 使用 Promise 不等待，后台异步处理
    analyzeAndUpdateComment(comment.id, content.trim(), config, commentData, session).catch((err: any) =>
      console.error('[ai-detection-async] 后台处理失败:', getErrorMessage(err))
    )
  }

  // 需要审核时给管理员发邮件提醒（后台异步发送）
  if (config.commentApproval) {
    // 异步发送通知，不阻塞响应
    ;(async () => {
      try {
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { title: true, slug: true, publicId: true, author: { select: { username: true } } },
        })
        if (post) {
          const commenterName = session?.username || commentData.guestName || '匿名访客'
          const postUrl = getPostUrl(post, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
          await sendNewCommentNotification({
            postTitle: post.title,
            postUrl,
            commenterName,
            content: content.trim(),
            customSubject: config.emailSubjectNewComment || undefined,
            senderName: config.emailSenderName || undefined,
          })
        }
      } catch (err) {
        console.error('[email-notification] 邮件发送失败:', err)
      }
    })()
  }

  revalidateTag('comments')
  return NextResponse.json(responseData)
}

/**
 * 后台异步执行 AI 检测和评论更新
 * 不阻塞主响应
 */
async function analyzeAndUpdateComment(
  commentId: string,
  content: string,
  config: SiteConfig,
  commentData: any,
  session: any
) {
  try {
    if (DEBUG) console.log('[ai-analysis-async] 开始后台 AI 分析:', { commentId, contentLength: content.length })

    const aiResult = await analyzeCommentWithAI(
      content,
      // 按评论功能解析 API Key：优先用对应 provider 的专属 key
      (() => {
        const provider = config.commentAiProvider || config.aiModelProvider || 'openrouter'
        if (provider === 'groq') return config.groqApiKey || config.aiModelApiKey
        if (provider === 'openrouter') return config.openrouterApiKey || config.aiModelApiKey
        return config.aiModelApiKey
      })(),
      // 优先使用评论专用模型，回退到全局模型
      config.commentAiModel || config.aiModelName || config.openrouterModel,
      commentData.guestName,
      commentData.guestEmail,
      commentData.guestWebsite,
      config.aiModelMaxTokens,
      // 评论功能专用 provider 优先，回退到全局
      config.commentAiProvider || config.aiModelProvider || 'openrouter',
      config.aiModelBaseUrl || undefined
    )

    if (DEBUG) console.log('[ai-analysis-async] AI 分析完成:', { commentId, riskScore: aiResult.riskScore })

    // 根据强度等级和 AI 风险评分决定是否自动通过/隐藏
    let approved: boolean | undefined = undefined

    // riskScore = -1 表示 AI 限速（429）：不更新 approved，保持原有待审状态
    if (aiResult.riskScore === -1) {
      if (DEBUG) console.log('[ai-analysis-async] ⚠️ AI 限速(429)，评论保持待审状态')
      await prisma.comment.update({
        where: { id: commentId },
        data: { riskReasons: JSON.stringify(['AI 限速，待人工审核']) },
      })
      syslog.warn('ai', 'AI 限速 (429)，评论保持待审', { commentId }).catch(() => {})
      return
    }

    // riskScore = 0 且 riskReasons 包含配置缺失提示，或 riskReasons 为空数组
    // 均说明 AI 未实际完成有效分析，应保持待审，不能依据 0 分放行
    const isAiSkipped =
      aiResult.riskScore === 0 &&
      (aiResult.riskReasons.length === 0 ||
        aiResult.riskReasons.some((r) => r.includes('未配置') || r.includes('not configured')))
    if (isAiSkipped) {
      if (DEBUG)
        console.log('[ai-analysis-async] ⚠️ AI 未返回有效分析结果（配置缺失或 reasons 为空），评论保持待审状态')
      await prisma.comment.update({
        where: { id: commentId },
        data: { riskReasons: JSON.stringify(aiResult.riskReasons) },
      })
      syslog
        .warn('ai', 'AI 未返回有效分析（配置缺失或 reasons 为空），评论保持待审', {
          commentId,
          reasons: aiResult.riskReasons,
        })
        .catch(() => {})
      return
    }

    const reviewStrength = (config.aiReviewStrength || 'balanced') as 'lenient' | 'balanced' | 'strict'
    const thresholdMap: Record<'lenient' | 'balanced' | 'strict', number> = {
      lenient: 30, // 宽松：风险分 < 30 自动通过
      balanced: 20, // 平衡：风险分 < 20 自动通过
      strict: 10, // 严格：风险分 < 10 自动通过
    }
    const autoApproveThreshold = thresholdMap[reviewStrength] || 20

    if (!session) {
      // 访客评论：三段式决策
      if (aiResult.riskScore >= 70) {
        // ① 高风险 → 自动拒绝
        approved = false
        if (DEBUG) console.log('[ai-analysis-async] ⚠️ 高风险评论自动隐藏')
      } else if (config.aiAutoApprove && aiResult.riskScore < autoApproveThreshold) {
        // ② 低风险 + 启用自动通过 → 通过
        approved = true
        if (DEBUG)
          console.log(
            '[ai-analysis-async] ✅ 安全评论自动通过 (评审强度:',
            reviewStrength,
            ', 阈值:',
            autoApproveThreshold,
            ')'
          )
      } else {
        // ③ 中等风险（threshold~70），或未启用 aiAutoApprove → 回落到人工审核开关
        // 若 commentApproval=false（不需人工审核），低风险也放行；否则保持 false 待审
        approved = !config.commentApproval && aiResult.riskScore < autoApproveThreshold
        if (DEBUG)
          console.log(
            '[ai-analysis-async] ℹ️ 中等风险/未开启自动通过，依据 commentApproval 决定:',
            approved,
            '(riskScore:',
            aiResult.riskScore,
            'threshold:',
            autoApproveThreshold,
            ')'
          )
      }
    }

    // 更新数据库
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        riskScore: aiResult.riskScore,
        riskReasons: JSON.stringify(aiResult.riskReasons),
        ...(approved !== undefined && { approved }),
      },
    })

    if (DEBUG) console.log('[ai-analysis-async] ✅ 评论已更新:', { commentId, riskScore: aiResult.riskScore, approved })

    // 写入结构化日志
    const logLevel = aiResult.riskScore >= 70 ? 'warn' : 'info'
    const action = approved === false ? '自动隐藏' : approved === true ? '自动通过' : '待人工审核'
    syslog[logLevel]('ai', `AI 审核完成 [${action}] 风险分=${aiResult.riskScore}`, {
      commentId,
      riskScore: aiResult.riskScore,
      riskReasons: aiResult.riskReasons,
      confidence: aiResult.confidence,
      approved,
      model: config.aiModelName || config.openrouterModel,
    }).catch(() => {})
  } catch (error: unknown) {
    console.error('[ai-analysis-async] ❌ 后台分析失败:', getErrorMessage(error))
    syslog.error('ai', `AI 分析异常: ${getErrorMessage(error)}`, { commentId }).catch(() => {})
    // 失败时只更新错误状态，不影响已保存的评论
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          riskReasons: JSON.stringify(['AI 分析异常，已保存为待审']),
        },
      })
    } catch (updateError) {
      console.error('[ai-analysis-async] 更新失败:', updateError)
    }
  }
}
