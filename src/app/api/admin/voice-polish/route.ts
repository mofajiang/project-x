import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAi, rowToAiFullConfig, AI_CONFIG_SELECT } from '@/lib/ai-call'

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

  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>(
    `SELECT ${AI_CONFIG_SELECT} FROM SiteConfig WHERE id = 'singleton'`
  )
  const cfg = rowToAiFullConfig(rows[0] || {})

  if (!cfg.groqApiKey && !cfg.openrouterApiKey && !cfg.aiModelApiKey) {
    return NextResponse.json({ error: '请先在「AI 模型」设置中配置 API 密钥和模型名称' }, { status: 422 })
  }

  try {
    const polished = await callAi(
      'voicePolish',
      cfg,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      { maxTokens: 1000, temperature: 0.4 }
    )
    if (!polished) return NextResponse.json({ error: 'AI 返回内容为空' }, { status: 502 })
    return NextResponse.json({ polished })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI 调用失败: ' + msg }, { status: 502 })
  }
}
