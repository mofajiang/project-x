import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { fetchWithTimeout, sleep } from '@/lib/fetch-utils'

export interface FriendLinkReviewResult {
  score: number
  reasons: string[]
  recommendation: 'approve' | 'reject' | 'manual'
  details: {
    brandSafety: number
    spamRisk: number
    malwareRisk: number
    contentRisk: number
  }
}

function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isRetryableAiError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error || '')
  return (
    msg.includes('AI API returned 429') ||
    msg.includes('AI API returned 500') ||
    msg.includes('AI API returned 502') ||
    msg.includes('AI API returned 503') ||
    msg.includes('AI API returned 504') ||
    msg.includes('fetch failed') ||
    msg.includes('aborted') ||
    msg.includes('timeout')
  )
}

async function callAiModel(prompt: string, config: any): Promise<string> {
  const timeout = toSafeNumber(config.aiModelTimeout, 30)

  let url: string
  let headers: Record<string, string>
  let body: any

  if (config.aiModelProvider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.aiModelApiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    }
    body = {
      model: config.aiModelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: toSafeNumber(config.aiModelMaxTokens, 2000),
      temperature: 0.3,
    }
  } else if (config.aiModelProvider === 'custom') {
    url = `${config.aiModelBaseUrl}/api/chat`
    headers = {
      'Content-Type': 'application/json',
    }
    if (config.aiModelApiKey) {
      headers['Authorization'] = `Bearer ${config.aiModelApiKey}`
    }
    body = {
      model: config.aiModelName,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }
  } else {
    throw new Error('Unknown AI provider')
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, timeout * 1000)

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`)
    }

    const data = await response.json()
    if (config.aiModelProvider === 'openrouter') {
      return data.choices[0].message.content
    }
    return data.message.content || data.content
  } catch (error: any) {
    throw new Error(`AI model call failed: ${error.message}`)
  }
}

export async function reviewFriendLinkById(linkId: string): Promise<FriendLinkReviewResult> {
  const configRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT enableAiDetection, aiReviewStrength, aiAutoApprove,
            aiModelProvider, aiModelName, aiModelBaseUrl, aiModelApiKey,
            COALESCE(aiModelMaxTokens,2000) as aiModelMaxTokens,
            COALESCE(aiModelTimeout,30) as aiModelTimeout,
            enableCustomAiModel
     FROM SiteConfig WHERE id = 'singleton'`
  )
  const config = configRows[0] || null

  if (config) {
    config.enableAiDetection = Number(config.enableAiDetection)
    config.aiAutoApprove = Number(config.aiAutoApprove)
    config.aiModelMaxTokens = toSafeNumber(config.aiModelMaxTokens, 2000)
    config.aiModelTimeout = toSafeNumber(config.aiModelTimeout, 30)
  }

  if (!config || !Number(config.enableAiDetection)) {
    throw new Error('AI detection is not enabled')
  }

  const link = await prisma.friendLink.findUnique({ where: { id: linkId } })
  if (!link) {
    throw new Error('Link not found')
  }

  const reviewPrompt = `
请分析以下网站链接的安全性，并返回 JSON 格式的结果。

网站信息：
- 名称：${link.name}
- URL：${link.url}
- 描述：${link.description || '无'}

请评估以下方面（0-100 分，分数越低越安全）：
1. brandSafety: 品牌安全性（是否涉及违规品牌、山寨等）
2. spamRisk: 垃圾风险（是否可能是垃圾网站）
3. malwareRisk: 恶意软件风险（是否可能包含恶意内容）
4. contentRisk: 内容风险（敏感/违规内容风险）

请返回以下 JSON 格式，不要包含其他内容：
{
  "score": <总体风险评分 0-100>,
  "reasons": [<风险原因列表>],
  "details": {
    "brandSafety": <0-100>,
    "spamRisk": <0-100>,
    "malwareRisk": <0-100>,
    "contentRisk": <0-100>
  }
}
`

  const aiModelConfig = {
    enableCustomAiModel: config.enableCustomAiModel,
    aiModelName: config.aiModelName,
    aiModelProvider: config.aiModelProvider,
    aiModelBaseUrl: config.aiModelBaseUrl,
    aiModelApiKey: config.aiModelApiKey,
    aiModelMaxTokens: config.aiModelMaxTokens || 2000,
    aiModelTimeout: config.aiModelTimeout || 30,
  }

  let aiResponse = ''
  try {
    aiResponse = await callAiModel(reviewPrompt, aiModelConfig)
  } catch (error) {
    if (!isRetryableAiError(error)) throw error

    console.warn(`[friend-link-review] retrying once for link=${link.id} due to transient AI error: ${error instanceof Error ? error.message : String(error)}`)
    await sleep(600)
    aiResponse = await callAiModel(reviewPrompt, aiModelConfig)
  }

  let reviewResult: FriendLinkReviewResult
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    const parsed = JSON.parse(jsonMatch[0])
    reviewResult = {
      score: Math.min(100, Math.max(0, parsed.score || 50)),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
      details: parsed.details || {
        brandSafety: 50,
        spamRisk: 50,
        malwareRisk: 50,
        contentRisk: 50,
      },
      recommendation: 'manual',
    }
  } catch {
    reviewResult = {
      score: 50,
      reasons: ['无法解析 AI 审核结果'],
      details: {
        brandSafety: 50,
        spamRisk: 50,
        malwareRisk: 50,
        contentRisk: 50,
      },
      recommendation: 'manual',
    }
  }

  const strength = config.aiReviewStrength || 'balanced'
  const thresholds = {
    lenient: { auto_reject: 85, auto_approve: 20 },
    balanced: { auto_reject: 70, auto_approve: 40 },
    strict: { auto_reject: 60, auto_approve: 40 },
  }

  const threshold = thresholds[strength as keyof typeof thresholds] || thresholds.balanced
  if (reviewResult.score >= threshold.auto_reject) {
    reviewResult.recommendation = 'reject'
  } else if (reviewResult.score <= threshold.auto_approve) {
    reviewResult.recommendation = 'approve'
  } else {
    reviewResult.recommendation = 'manual'
  }

  const autoApproveEnabled = Boolean(Number(config.aiAutoApprove))
  const finalStatus = reviewResult.recommendation === 'reject'
    ? 'rejected'
    : (reviewResult.recommendation === 'approve' && autoApproveEnabled ? 'approved' : link.status)

  console.log(
    `[friend-link-review] link=${link.id} score=${reviewResult.score} strength=${strength} recommendation=${reviewResult.recommendation} autoApprove=${autoApproveEnabled} finalStatus=${finalStatus}`
  )

  await prisma.friendLink.update({
    where: { id: linkId },
    data: {
      aiScore: reviewResult.score,
      aiReview: JSON.stringify(reviewResult),
      status: finalStatus,
      approvedAt: reviewResult.recommendation === 'approve' && autoApproveEnabled ? new Date() : link.approvedAt,
      rejectionReason:
        reviewResult.recommendation === 'reject'
          ? `AI 安全检测不通过（风险评分：${reviewResult.score}/100）`
          : link.rejectionReason,
    },
  })

  revalidateTag('approved-friend-links')

  return reviewResult
}
