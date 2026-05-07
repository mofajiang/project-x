import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ count: 0 }, { status: 401 })

  const count = await prisma.comment.count({ where: { approved: false } })

  // 检查 AI Key 是否配置
  let aiKeyMissing = false
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(aiModelApiKey,'') as aiModelApiKey,
              COALESCE(openrouterApiKey,'') as openrouterApiKey,
              COALESCE(groqApiKey,'') as groqApiKey,
              COALESCE(enableAiDetection,1) as enableAiDetection
       FROM SiteConfig WHERE id = 'singleton'`
    )
    const cfg = rows[0]
    aiKeyMissing =
      Boolean(Number(cfg?.enableAiDetection)) && !cfg?.aiModelApiKey && !cfg?.openrouterApiKey && !cfg?.groqApiKey
  } catch {}

  return NextResponse.json({ count, aiKeyMissing })
}
