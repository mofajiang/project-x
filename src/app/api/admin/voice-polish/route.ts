import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `你是一位专业的文字编辑。用户将提供一段从语音转录的口语文本，请将其整理成通顺、规范的书面中文。要求：
1. 保留原意和作者个人风格
2. 去除口头禅、重复词和语气助词（如"那个""就是""嗯""啊"等）
3. 适当添加标点符号，改善断句
4. 将口语表达转换为书面语，但不改变语气和内容
5. 只返回整理后的纯文本，不加任何额外说明`

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let text: string
  try {
    const body = await request.json()
    text = (body.text || '').trim()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!text) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })

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
    // custom / ollama
    const base = (cfg.aiModelBaseUrl || '').replace(/\/+$/, '')
    url = cfg.aiModelProvider === 'ollama' ? `${base}/api/chat` : `${base}/v1/chat/completions`
    if (cfg.aiModelApiKey) headers['Authorization'] = `Bearer ${cfg.aiModelApiKey}`
  }

  const timeout = (Number(cfg.aiModelTimeout) || 30) * 1000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const isOllama = cfg.aiModelProvider === 'ollama'
  const bodyPayload = {
    model: cfg.aiModelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    max_tokens: Math.min(Number(cfg.aiModelMaxTokens) || 2000, 2000),
    temperature: 0.4,
    ...(isOllama ? { stream: false } : {}),
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
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
