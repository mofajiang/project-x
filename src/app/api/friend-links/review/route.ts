import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ReviewResult {
  score: number // 0-100，分数越低越安全
  reasons: string[]
  recommendation: 'approve' | 'reject' | 'manual' // approve | reject | manual review
  details: {
    brandSafety: number
    spamRisk: number
    malwareRisk: number
    contentRisk: number
  }
}

async function callAiModel(prompt: string, config: any): Promise<string> {
  const timeout = config.aiModelTimeout || 30
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000)

  try {
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
        max_tokens: config.aiModelMaxTokens || 2000,
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

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`)
    }

    const data = await response.json()
    
    if (config.aiModelProvider === 'openrouter') {
      return data.choices[0].message.content
    } else {
      return data.message.content || data.content
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    throw new Error(`AI model call failed: ${error.message}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { linkId } = await request.json()

    // 获取站点配置
    const config = await prisma.siteConfig.findUnique({
      where: { id: 'singleton' },
    })

    if (!config || !config.enableAiDetection) {
      return NextResponse.json(
        { error: 'AI detection is not enabled' },
        { status: 400 }
      )
    }

    // 获取友链信息
    const link = await prisma.friendLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // 构建审核提示词
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

    // 调用 AI 模型
    const aiResponse = await callAiModel(
      reviewPrompt,
      {
        enableCustomAiModel: config.enableCustomAiModel,
        aiModelName: config.aiModelName,
        aiModelProvider: config.aiModelProvider,
        aiModelBaseUrl: config.aiModelBaseUrl,
        aiModelApiKey: config.aiModelApiKey,
        aiModelMaxTokens: config.aiModelMaxTokens || 2000,
        aiModelTimeout: config.aiModelTimeout || 30,
      }
    )

    // 解析 AI 响应
    let reviewResult: ReviewResult
    try {
      // 尝试提取 JSON
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
      // 如果无法解析，返回中等风险
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

    // 根据审核强度和分数确定建议
    const strength = config.aiReviewStrength || 'balanced'
    const thresholds = {
      lenient: { auto_reject: 85, auto_approve: 20 },
      balanced: { auto_reject: 70, auto_approve: 30 },
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

    // 保存审核结果
    await prisma.friendLink.update({
      where: { id: linkId },
      data: {
        aiScore: reviewResult.score,
        aiReview: JSON.stringify(reviewResult),
        // 根据建议自动处理状态
        status: reviewResult.recommendation === 'reject' ? 'rejected' : link.status,
        rejectionReason:
          reviewResult.recommendation === 'reject'
            ? `AI 安全检测不通过（风险评分：${reviewResult.score}/100）`
            : link.rejectionReason,
      },
    })

    return NextResponse.json(reviewResult)
  } catch (error) {
    console.error('Friend link AI review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审核失败' },
      { status: 500 }
    )
  }
}
