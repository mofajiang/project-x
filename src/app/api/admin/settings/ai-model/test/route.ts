import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getErrorMessage } from '@/lib/converters'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await request.json()
    const { provider, baseUrl, model, timeout } = data
    let { apiKey } = data

    // 如果 API Key 被掩盖（保存后前端展示的是 ***），从数据库取真实 key
    // 使用 raw SQL 避免 Prisma 客户端不认识动态迁移字段
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

      const testMessage = '你好，请用一句话介绍你自己'
      if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }
        body = { model, messages: [{ role: 'user', content: testMessage }], max_tokens: 200 }
      } else if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions'
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
        body = { model, messages: [{ role: 'user', content: testMessage }], max_tokens: 200 }
      } else if (provider === 'custom') {
        const cleanBase = (baseUrl || '').replace(/\/+$/, '')
        url = `${cleanBase}/v1/chat/completions`
        headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
        body = { model, messages: [{ role: 'user', content: testMessage }], max_tokens: 200, stream: false }
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
        const json = await response.json()
        const reply = json?.choices?.[0]?.message?.content || ''
        return NextResponse.json({ success: true, message: '连接成功', reply, question: testMessage })
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
