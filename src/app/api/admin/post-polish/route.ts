import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `你是一位专业的中文内容编辑，擅长博客文章润色。对用户提供的 Markdown 格式文章，请进行以下优化：
1. 修正语法错误和错别字
2. 优化句子流畅度和表达力，保留作者个人风格
3. 改善段落衔接和逻辑连贯性
4. 保持 Markdown 格式和特殊语法（代码块、图片、链接等）完整不变
5. 不删减实质内容，不改变文章主旨
6. 只返回润色后的完整 Markdown 文本，不加任何额外说明`

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let content: string
  try {
    const body = await request.json()
    content = (body.content || '').trim()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!content) return NextResponse.json({ error: '文章内容不能为空' }, { status: 400 })
  if (content.length > 20000) {
    return NextResponse.json({ error: '文章过长（超过 20000 字），请分段润色' }, { status: 400 })
  }

  // 读取 AI 配置
  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>(
    `SELECT aiModelProvider, aiModelName, aiModelBaseUrl, aiModelApiKey,
            COALESCE(aiModelMaxTokens, 2000) as aiModelMaxTokens,
            COALESCE(aiModelTimeout, 30) as aiModelTimeout
     FROM SiteConfig WHERE id = 'singleton'`
  )
  const cfg = rows[0]

  if (!cfg?.aiModelApiKey || !cfg?.aiModelName) {
    return NextResponse.json({ error: '请先在「AI 模型」设置中配置 API 密钥和模型名称' }, { status: 422 })
  }

  // 构建请求
  let url: string
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (cfg.aiModelProvider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers['Authorization'] = `Bearer ${cfg.aiModelApiKey}`
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  } else if (cfg.aiModelProvider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'
    headers['Authorization'] = `Bearer ${cfg.aiModelApiKey}`
  } else {
    const base = (cfg.aiModelBaseUrl || '').replace(/\/+$/, '')
    url = cfg.aiModelProvider === 'ollama' ? `${base}/api/chat` : `${base}/v1/chat/completions`
    if (cfg.aiModelApiKey) headers['Authorization'] = `Bearer ${cfg.aiModelApiKey}`
  }

  const isOllama = cfg.aiModelProvider === 'ollama'
  // 润色需要更多 token
  const maxTokens = Math.min(Math.max(Number(cfg.aiModelMaxTokens) || 2000, content.length + 500), 8000)
  const timeout = (Number(cfg.aiModelTimeout) || 60) * 1000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.aiModelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        max_tokens: maxTokens,
        temperature: 0.5,
        ...(isOllama ? { stream: false } : {}),
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return NextResponse.json({ error: `AI 服务错误 (${res.status}): ${err.slice(0, 200)}` }, { status: 502 })
    }

    const data = await res.json()
    const polished: string = isOllama
      ? (data.message?.content ?? '').trim()
      : (data.choices?.[0]?.message?.content ?? '').trim()

    if (!polished) {
      return NextResponse.json({ error: 'AI 返回内容为空' }, { status: 502 })
    }

    return NextResponse.json({ polished })
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI 调用超时或失败: ' + msg }, { status: 502 })
  }
}
