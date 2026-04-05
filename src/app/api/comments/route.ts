import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getSiteConfig } from '@/lib/config'
import { runMigrations } from '@/lib/db-migrate'
import { sendNewCommentNotification } from '@/lib/mailer'
import { getClientIp } from '@/lib/request-ip'
import { analyzeCommentWithAI, quickSpamCheck } from '@/lib/openrouter-spam-filter'

export async function POST(req: NextRequest) {
  await runMigrations()
  const session = await getSessionFromRequest(req)

  const { postId, content, parentId, guestName, guestEmail, guestWebsite } = await req.json()
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
      try { new URL(guestWebsite.trim()) } catch {
        return NextResponse.json({ error: '网站地址格式不正确' }, { status: 400 })
      }
    }
  }

  const config = await getSiteConfig()
  const ip = getClientIp(req)

  // 构建评论数据，兼容 guestName 列不存在的情况
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentData: any = {
    content: content.trim(),
    postId,
    authorId: session?.userId || null,
    parentId: parentId || null,
    approved: !config.commentApproval,
    ip,
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
  } catch (e: any) {
    // guestName 列可能尚未迁移，降级去掉该字段重试
    if (e?.message?.includes('guestName') || e?.message?.includes('guestEmail') || e?.message?.includes('guestWebsite') || e?.message?.includes('ip') || e?.message?.includes('no such column')) {
      delete commentData.guestName
      delete commentData.guestEmail
      delete commentData.guestWebsite
      delete commentData.ip
      comment = await prisma.comment.create({ data: commentData })
    } else {
      console.error('[comment create]', e?.message)
      return NextResponse.json({ error: '评论提交失败，请重试' }, { status: 500 })
    }
  }

  // AI 垃圾评论检测
  const quickCheck = quickSpamCheck(content.trim(), commentData.guestEmail)
  let riskScore = quickCheck.localRiskScore
  let riskReasons: string[] = []

  // 如果本地检查风险 >= 20 或配置启用AI检测，则调用 OpenRouter AI
  if (quickCheck.shouldAnalyze || config.enableAiDetection) {
    try {
      const aiResult = await analyzeCommentWithAI(
        content.trim(),
        config.openrouterApiKey,
        config.openrouterModel,
        commentData.guestName,
        commentData.guestEmail,
        commentData.guestWebsite
      )
      riskScore = aiResult.riskScore
      riskReasons = aiResult.riskReasons
      
      // 高风险评论自动隐藏（保存但不显示）
      if (aiResult.riskScore >= 70 && !session) {
        comment = await prisma.comment.update({
          where: { id: comment.id },
          data: {
            approved: false,
            riskScore: aiResult.riskScore,
            riskReasons: JSON.stringify(aiResult.riskReasons),
          },
        })
      } else {
        comment = await prisma.comment.update({
          where: { id: comment.id },
          data: {
            riskScore: aiResult.riskScore,
            riskReasons: JSON.stringify(aiResult.riskReasons),
          },
        })
      }
    } catch (e: any) {
      console.error('[ai-detection] 分析失败:', e?.message)
      // AI 检测失败不阻断评论提交，只记录本地检查结果
      if (quickCheck.localRiskScore > 0) {
        comment = await prisma.comment.update({
          where: { id: comment.id },
          data: {
            riskScore: quickCheck.localRiskScore,
            riskReasons: JSON.stringify(['本地检查 - AI 连接失败']),
          },
        })
      }
    }
  }

  // 需要审核时给管理员发邮件提醒
  if (config.commentApproval) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { title: true, slug: true } })
    if (post) {
      const commenterName = session?.username || commentData.guestName || '匿名访客'
      const postUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + '/post/' + post.slug
      sendNewCommentNotification({ postTitle: post.title, postUrl, commenterName, content: content.trim() }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, comment })
}