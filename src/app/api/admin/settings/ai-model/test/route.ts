import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from '@/lib/converters'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await request.json()
    let { provider, baseUrl, apiKey, model, timeout } = data

    // 如果 API Key 被掩盖（保存后前端展示的是 ***），从数据库取真实 key
    // 使用 raw SQL 而非 prisma.siteConfig.findUnique，
    // 避免 Prisma client 未重新生成时 aiModelApiKey 字段缺失导致读取为空
    if (!apiKey || apiKey.includes('***')) {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT aiModelApiKey FROM SiteConfig WHERE id = 'singleton'`)
      apiKey = rows[0]?.aiModelApiKey || ''
    }

    if (!apiKey) {
      return NextResponse.json({ error: '请先填写并保存 API Key' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), (timeout || 30) * 1000)

    try {
      let url: string
      let headers: Record<string, string>
      let body: any

      if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }
        body = {
          model,
          messages: [{ role: 'user', content: '测试连接' }],
          max_tokens: 10,
        }
      } else if (provider === 'custom') {
        url = `${baseUrl}/api/chat`
        headers = {
          'Content-Type': 'application/json',
        }
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`
        }
        body = {
          model,
          messages: [{ role: 'user', content: '测试连接' }],
          stream: false,
        }
      } else {
        return NextResponse.json({ error: '未知的提供商' }, { status: 400 })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return NextResponse.json({ success: true, message: '连接成功' })
      } else {
        const error = await response.text()
        return NextResponse.json(
          { error: `API 返回错误: ${response.status} - ${error.slice(0, 100)}` },
          { status: 400 }
        )
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof DOMException && error.name === 'AbortError') {
        return NextResponse.json({ error: '请求超时' }, { status: 408 })
      }
      return NextResponse.json({ error: `连接失败: ${getErrorMessage(error)}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 })
  }
}
