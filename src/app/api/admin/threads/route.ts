import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await prisma.$queryRawUnsafe<
      { threadId: string; count: number; firstTitle: string | null; nextOrder: number }[]
    >(`
      SELECT
        p.threadId,
        COUNT(*) as count,
        (SELECT title FROM Post WHERE threadId = p.threadId ORDER BY threadOrder ASC, publishedAt ASC LIMIT 1) as firstTitle,
        MAX(p.threadOrder) + 1 as nextOrder
      FROM Post p
      WHERE p.threadId IS NOT NULL
      GROUP BY p.threadId
      ORDER BY MAX(p.publishedAt) DESC
      LIMIT 50
    `)

    return NextResponse.json(
      rows.map((r) => ({
        threadId: r.threadId,
        count: Number(r.count),
        firstTitle: r.firstTitle || '无标题',
        nextOrder: Number(r.nextOrder),
      }))
    )
  } catch {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
