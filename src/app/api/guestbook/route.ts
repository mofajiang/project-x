import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getSiteConfig } from '@/lib/config'
import { getClientIp } from '@/lib/request-ip'
import { rateLimit } from '@/lib/rate-limit'
import { quickSpamCheck, analyzeCommentWithAI } from '@/lib/openrouter-spam-filter'
import { getErrorMessage } from '@/lib/converters'
import { AI_REVIEW_THRESHOLDS, type AiReviewStrength } from '@/lib/constants'
import type { AiFullConfig } from '@/lib/ai-call'

function buildAiConfig(config: Record<string, any>): AiFullConfig {
  return {
    groqApiKey: config.groqApiKey || '',
    openrouterApiKey: config.openrouterApiKey || '',
    aiModelBaseUrl: config.aiModelBaseUrl || '',
    aiModelApiKey: config.aiModelApiKey || '',
    aiModelProvider: config.aiModelProvider || 'openrouter',
    aiModelName: config.aiModelName || config.openrouterModel || '',
    aiModelMaxTokens: config.aiModelMaxTokens || 2000,
    aiModelTimeout: config.aiModelTimeout || 30,
    commentAiProvider: config.commentAiProvider || '',
    commentAiModel: config.commentAiModel || '',
    friendLinkAiProvider: config.friendLinkAiProvider || '',
    friendLinkAiModel: config.friendLinkAiModel || '',
    voicePolishAiProvider: config.voicePolishAiProvider || '',
    voicePolishAiModel: config.voicePolishAiModel || '',
    postPolishAiProvider: config.postPolishAiProvider || '',
    postPolishAiModel: config.postPolishAiModel || '',
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(30, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))

  try {
    const [messages, total] = await Promise.all([
      prisma.guestbookMessage.findMany({
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          content: true,
          guestName: true,
          guestWebsite: true,
          author: { select: { username: true, avatar: true, displayName: true } },
          createdAt: true,
        },
      }),
      prisma.guestbookMessage.count({ where: { approved: true } }),
    ])

    return NextResponse.json({
      messages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  if (!rateLimit(`guestbook:${clientIp}`, { max: 3, windowMs: 60_000 })) {
    return NextResponse.json({ error: '留言太频繁，请稍后再试' }, { status: 429 })
  }

  const session = await getSessionFromRequest(req)

  const body = await req.json()
  const { content, guestName, guestEmail, guestWebsite } = body

  if (!content?.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
  if (content.trim().length > 1000) return NextResponse.json({ error: '留言不能超过1000字' }, { status: 400 })

  if (!session) {
    const name = (guestName || '').trim()
    if (!name) return NextResponse.json({ error: '请填写昵称' }, { status: 400 })
    if (name.length > 20) return NextResponse.json({ error: '昵称不超过20字' }, { status: 400 })
    if (guestEmail?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
      }
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

  // 本地快速垃圾检测
  const quickCheck = quickSpamCheck(content.trim(), guestEmail)

  // 构建数据
  const messageData: Record<string, unknown> = {
    content: content.trim(),
    guestName: session
      ? session.username
      : (guestName || '')
          .trim()
          .replace(/<[^>]*>/g, '')
          .slice(0, 50),
    authorId: session?.userId || null,
    ip,
    approved: session ? true : config.enableAiDetection ? false : !config.commentApproval,
    riskScore: quickCheck.localRiskScore,
    riskReasons: JSON.stringify(quickCheck.localRiskScore > 0 ? ['本地检查中...'] : []),
  }

  if (!session && guestEmail?.trim()) {
    messageData.guestEmail = guestEmail.trim()
  }
  if (!session && guestWebsite?.trim()) {
    messageData.guestWebsite = guestWebsite.trim()
  }

  let message
  try {
    message = await prisma.guestbookMessage.create({ data: messageData as any })
  } catch (e: unknown) {
    if (
      getErrorMessage(e).includes('no such column') ||
      getErrorMessage(e).includes('guestEmail') ||
      getErrorMessage(e).includes('guestWebsite') ||
      getErrorMessage(e).includes('guestName') ||
      getErrorMessage(e).includes('ip')
    ) {
      delete messageData.guestEmail
      delete messageData.guestWebsite
      delete messageData.ip
      try {
        message = await prisma.guestbookMessage.create({ data: messageData as any })
      } catch (retryErr: unknown) {
        console.error('[guestbook create retry]', getErrorMessage(retryErr))
        return NextResponse.json({ error: '留言提交失败，请重试' }, { status: 500 })
      }
    } else {
      console.error('[guestbook create]', getErrorMessage(e))
      return NextResponse.json({ error: '留言提交失败，请重试' }, { status: 500 })
    }
  }

  // 后台异步 AI 检测（仅访客留言）
  if (!session && (quickCheck.shouldAnalyze || config.enableAiDetection)) {
    const aiCfg = buildAiConfig(config)
    const gName = (messageData.guestName as string) || ''
    const gEmail = (messageData.guestEmail as string) || ''
    const gWebsite = (messageData.guestWebsite as string) || ''
    analyzeCommentWithAI(content.trim(), aiCfg, gName, gEmail, gWebsite)
      .then(async (aiResult) => {
        let approved: boolean | undefined
        if (aiResult.riskScore === -1) {
          await prisma.guestbookMessage.update({
            where: { id: message.id },
            data: {
              riskReasons: JSON.stringify(
                aiResult.riskReasons.length ? aiResult.riskReasons : ['AI 未完成分析，待人工审核']
              ),
            },
          })
          return
        }
        const isAiSkipped =
          aiResult.riskScore === 0 &&
          (aiResult.riskReasons.length === 0 ||
            aiResult.riskReasons.some((r) => r.includes('未配置') || r.includes('not configured')))
        if (isAiSkipped) {
          await prisma.guestbookMessage.update({
            where: { id: message.id },
            data: { riskReasons: JSON.stringify(aiResult.riskReasons) },
          })
          return
        }
        const reviewStrength = (config.aiReviewStrength || 'balanced') as AiReviewStrength
        const thresholds = AI_REVIEW_THRESHOLDS[reviewStrength] || AI_REVIEW_THRESHOLDS.balanced
        if (aiResult.riskScore >= thresholds.autoReject) {
          approved = false
        } else if (config.aiAutoApprove && aiResult.riskScore < thresholds.autoApprove) {
          approved = true
        } else {
          approved = !config.commentApproval && aiResult.riskScore < thresholds.autoApprove
        }
        await prisma.guestbookMessage.update({
          where: { id: message.id },
          data: {
            riskScore: aiResult.riskScore,
            riskReasons: JSON.stringify(aiResult.riskReasons),
            ...(approved !== undefined && { approved }),
          },
        })
      })
      .catch((err: unknown) => console.error('[guestbook-ai-detection] 后台处理失败:', getErrorMessage(err)))
  }

  return NextResponse.json({ ok: true, message })
}
