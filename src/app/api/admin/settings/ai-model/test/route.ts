import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { provider, baseUrl, apiKey, model, timeout } = data

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
          'Authorization': `Bearer ${apiKey}`,
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
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        return NextResponse.json({ error: '请求超时' }, { status: 408 })
      }
      return NextResponse.json({ error: `连接失败: ${error.message}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 })
  }
}
