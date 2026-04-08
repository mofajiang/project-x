import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { getSessionFromRequest } from '@/lib/auth'
import { revalidateSiteConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function ensureSiteConfigExists() {
  try {
    await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO SiteConfig (id) VALUES ('singleton')`)
  } catch (error) {
    console.warn('Failed to ensure SiteConfig exists:', error)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConfig(row: Record<string, any>) {
  const apiKey: string = row.aiModelApiKey || ''
  return {
    enableCustomAiModel: Boolean(Number(row.enableCustomAiModel)),
    aiModelProvider: row.aiModelProvider || 'openrouter',
    aiModelName: row.aiModelName || '',
    aiModelBaseUrl: row.aiModelBaseUrl || '',
    aiModelApiKey: apiKey ? apiKey.substring(0, 10) + '***' : '',
    aiModelMaxTokens: Number(row.aiModelMaxTokens) || 2000,
    aiModelTimeout: Number(row.aiModelTimeout) || 30,
    enableAiDetection: Boolean(Number(row.enableAiDetection)),
    aiReviewStrength: row.aiReviewStrength || 'balanced',
    aiAutoApprove: Boolean(Number(row.aiAutoApprove)),
  }
}

const DEFAULT_CONFIG = {
  enableCustomAiModel: false,
  aiModelProvider: 'openrouter',
  aiModelName: '',
  aiModelBaseUrl: '',
  aiModelApiKey: '',
  aiModelMaxTokens: 2000,
  aiModelTimeout: 30,
  enableAiDetection: false,
  aiReviewStrength: 'balanced',
  aiAutoApprove: false,
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // 确保列存在（服务器可能未运行 db:push）
    await runMigrations()
    await ensureSiteConfigExists()

    // 使用 raw SQL 读取，避免 Prisma 客户端版本不匹配时静默忽略字段
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT enableCustomAiModel, aiModelProvider, aiModelName, aiModelBaseUrl,
              aiModelApiKey, aiModelMaxTokens, aiModelTimeout,
              enableAiDetection, aiReviewStrength, aiAutoApprove
       FROM SiteConfig WHERE id = 'singleton'`
    )

    if (!rows.length)
      return NextResponse.json(DEFAULT_CONFIG, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
      })
    return NextResponse.json(rowToConfig(rows[0]), {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
    })
  } catch (error) {
    console.error('Failed to fetch AI model config:', error)
    return NextResponse.json(
      { error: '获取配置失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // 确保列存在（服务器可能未运行 db:push）
    await runMigrations()
    await ensureSiteConfigExists()

    const data = await request.json()

    if (!data.aiModelProvider) {
      return NextResponse.json({ error: '请选择 AI 模型提供商' }, { status: 400 })
    }

    // 如果 API Key 被掩盖（***），从数据库读取真实值
    let apiKey = String(data.aiModelApiKey || '')
    if (!apiKey || apiKey.includes('***')) {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT aiModelApiKey FROM SiteConfig WHERE id = 'singleton'`)
      apiKey = rows[0]?.aiModelApiKey || ''
    }

    const maxTokens = Math.max(
      100,
      Math.min(1000000, Number.isFinite(Number(data.aiModelMaxTokens)) ? Number(data.aiModelMaxTokens) : 2000)
    )
    const timeout = Math.max(
      5,
      Math.min(300, Number.isFinite(Number(data.aiModelTimeout)) ? Number(data.aiModelTimeout) : 30)
    )

    // 使用 raw SQL 更新，避免 Prisma 客户端版本不匹配时静默忽略字段
    await prisma.$executeRawUnsafe(
      `UPDATE SiteConfig SET
         enableCustomAiModel = ?, aiModelProvider = ?, aiModelName = ?,
         aiModelBaseUrl = ?, aiModelApiKey = ?, aiModelMaxTokens = ?,
         aiModelTimeout = ?, enableAiDetection = ?, aiReviewStrength = ?, aiAutoApprove = ?
       WHERE id = 'singleton'`,
      data.enableCustomAiModel ? 1 : 0,
      String(data.aiModelProvider),
      String(data.aiModelName || ''),
      String(data.aiModelBaseUrl || ''),
      apiKey,
      maxTokens,
      timeout,
      data.enableAiDetection ? 1 : 0,
      String(data.aiReviewStrength || 'balanced'),
      data.aiAutoApprove ? 1 : 0
    )

    if (process.env.NODE_ENV === 'development')
      console.log('[ai-model POST] 保存成功:', {
        aiModelProvider: data.aiModelProvider,
        aiModelName: data.aiModelName,
        aiModelMaxTokens: maxTokens,
        aiModelTimeout: timeout,
        enableAiDetection: data.enableAiDetection,
        aiAutoApprove: data.aiAutoApprove,
      })

    // 读取刚保存的数据返回给前端
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT enableCustomAiModel, aiModelProvider, aiModelName, aiModelBaseUrl,
              aiModelApiKey, aiModelMaxTokens, aiModelTimeout,
              enableAiDetection, aiReviewStrength, aiAutoApprove
       FROM SiteConfig WHERE id = 'singleton'`
    )

    // 保存后让 getSiteConfig 缓存失效，确保评论 AI 分析读到新配置
    try {
      await revalidateSiteConfig()
    } catch {}

    return NextResponse.json(rows.length ? rowToConfig(rows[0]) : DEFAULT_CONFIG, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
    })
  } catch (error) {
    console.error('Failed to save AI model config:', error)
    return NextResponse.json(
      { error: '保存配置失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    )
  }
}
