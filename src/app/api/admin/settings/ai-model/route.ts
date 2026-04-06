import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.siteConfig.findUnique({
      where: { id: 'singleton' },
    })

    if (!settings) {
      // 返回默认配置
      return NextResponse.json({
        enableCustomAiModel: false,
        aiModelProvider: 'openrouter',
        aiModelName: 'claude-3.5-sonnet',
        aiModelBaseUrl: 'https://openrouter.ai/api/v1',
        aiModelApiKey: process.env.OPENROUTER_API_KEY || '',
        aiModelMaxTokens: 2000,
        aiModelTimeout: 30,
        enableAiDetection: false,
        aiReviewStrength: 'balanced',
        aiAutoApprove: false,
      })
    }

    return NextResponse.json({
      enableCustomAiModel: settings.enableCustomAiModel,
      aiModelProvider: settings.aiModelProvider,
      aiModelName: settings.aiModelName,
      aiModelBaseUrl: settings.aiModelBaseUrl,
      aiModelApiKey: settings.aiModelApiKey ? settings.aiModelApiKey.slice(0, 10) + '***' : '',
      aiModelMaxTokens: settings.aiModelMaxTokens,
      aiModelTimeout: settings.aiModelTimeout,
      enableAiDetection: settings.enableAiDetection,
      aiReviewStrength: settings.aiReviewStrength,
      aiAutoApprove: settings.aiAutoApprove,
    })
  } catch (error) {
    console.error('Failed to fetch AI model config:', error)
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // 如果 API Key 被掩盖了，不更新
    let apiKey = data.aiModelApiKey
    if (apiKey?.includes('***')) {
      const existing = await prisma.siteConfig.findUnique({
        where: { id: 'singleton' },
      })
      apiKey = existing?.aiModelApiKey || ''
    }

    const settings = await prisma.siteConfig.upsert({
      where: { id: 'singleton' },
      update: {
        enableCustomAiModel: data.enableCustomAiModel,
        aiModelProvider: data.aiModelProvider,
        aiModelName: data.aiModelName,
        aiModelBaseUrl: data.aiModelBaseUrl,
        aiModelApiKey: apiKey,
        aiModelMaxTokens: data.aiModelMaxTokens,
        aiModelTimeout: data.aiModelTimeout,
        enableAiDetection: data.enableAiDetection,
        aiReviewStrength: data.aiReviewStrength,
        aiAutoApprove: data.aiAutoApprove,
      },
      create: {
        id: 'singleton',
        enableCustomAiModel: data.enableCustomAiModel,
        aiModelProvider: data.aiModelProvider,
        aiModelName: data.aiModelName,
        aiModelBaseUrl: data.aiModelBaseUrl,
        aiModelApiKey: apiKey,
        aiModelMaxTokens: data.aiModelMaxTokens,
        aiModelTimeout: data.aiModelTimeout,
        enableAiDetection: data.enableAiDetection,
        aiReviewStrength: data.aiReviewStrength,
        aiAutoApprove: data.aiAutoApprove,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save AI model config:', error)
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 })
  }
}
