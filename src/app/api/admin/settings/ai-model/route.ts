import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function ensureSiteConfigExists() {
  try {
    await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO SiteConfig (id) VALUES ('singleton')`)
  } catch (error) {
    console.warn('Failed to ensure SiteConfig exists:', error)
  }
}

export async function GET() {
  try {
    // 确保配置记录存在
    await ensureSiteConfigExists()

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
      enableCustomAiModel: settings.enableCustomAiModel || false,
      aiModelProvider: settings.aiModelProvider || 'openrouter',
      aiModelName: settings.aiModelName || 'claude-3.5-sonnet',
      aiModelBaseUrl: settings.aiModelBaseUrl || '',
      aiModelApiKey: settings.aiModelApiKey ? settings.aiModelApiKey.substring(0, 10) + '***' : '',
      aiModelMaxTokens: settings.aiModelMaxTokens || 2000,
      aiModelTimeout: settings.aiModelTimeout || 30,
      enableAiDetection: settings.enableAiDetection || false,
      aiReviewStrength: settings.aiReviewStrength || 'balanced',
      aiAutoApprove: settings.aiAutoApprove || false,
    })
  } catch (error) {
    console.error('Failed to fetch AI model config:', error)
    return NextResponse.json(
      { error: '获取配置失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 确保配置记录存在
    await ensureSiteConfigExists()

    const data = await request.json()

    // 验证必须的字段
    if (!data.aiModelProvider) {
      return NextResponse.json(
        { error: '请选择 AI 模型提供商' },
        { status: 400 }
      )
    }

    // 如果 API Key 被掩盖了，不更新
    let apiKey = data.aiModelApiKey || ''
    if (apiKey.includes('***')) {
      const existing = await prisma.siteConfig.findUnique({
        where: { id: 'singleton' },
      })
      apiKey = existing?.aiModelApiKey || ''
    }

    const updateData = {
      enableCustomAiModel: Boolean(data.enableCustomAiModel),
      aiModelProvider: String(data.aiModelProvider),
      aiModelName: String(data.aiModelName || ''),
      aiModelBaseUrl: String(data.aiModelBaseUrl || ''),
      aiModelApiKey: String(apiKey),
      aiModelMaxTokens: Math.max(100, Math.min(10000, parseInt(data.aiModelMaxTokens) || 2000)),
      aiModelTimeout: Math.max(5, Math.min(300, parseInt(data.aiModelTimeout) || 30)),
      enableAiDetection: Boolean(data.enableAiDetection),
      aiReviewStrength: String(data.aiReviewStrength || 'balanced'),
      aiAutoApprove: Boolean(data.aiAutoApprove),
    }

    await prisma.siteConfig.update({
      where: { id: 'singleton' },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save AI model config:', error)
    return NextResponse.json(
      { error: '保存配置失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
