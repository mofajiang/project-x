import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAi, rowToAiFullConfig, AI_CONFIG_SELECT } from '@/lib/ai-call'

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

  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>(
    `SELECT ${AI_CONFIG_SELECT} FROM SiteConfig WHERE id = 'singleton'`
  )
  const cfg = rowToAiFullConfig(rows[0] || {})

  if (!cfg.groqApiKey && !cfg.openrouterApiKey && !cfg.aiModelApiKey) {
    return NextResponse.json({ error: '请先在「AI 模型」设置中配置 API 密钥和模型名称' }, { status: 422 })
  }

  try {
    const polished = await callAi(
      'postPolish',
      cfg,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      { maxTokens: Math.min(Math.max(content.length + 500, 2000), 8000), temperature: 0.5 }
    )
    if (!polished) return NextResponse.json({ error: 'AI 返回内容为空' }, { status: 502 })
    return NextResponse.json({ polished })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI 调用失败: ' + msg }, { status: 502 })
  }
}
