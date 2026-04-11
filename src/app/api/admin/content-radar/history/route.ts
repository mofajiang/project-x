import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const posts = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; publishedAt: string | null; content: string }>
    >(
      `SELECT id, title, publishedAt, content FROM Post
       WHERE content LIKE '%<!-- keyword-radar:%'
       ORDER BY createdAt DESC LIMIT 30`
    )

    const digests = await Promise.all(
      posts.map(async (post) => {
        const dateMatch = post.content.match(/<!-- keyword-radar:(\d{4}-\d{2}-\d{2}) -->/)
        const digestDate = dateMatch ? dateMatch[1] : ''
        const itemCountRows = digestDate
          ? await prisma.$queryRawUnsafe<{ cnt: number }[]>(
              `SELECT COUNT(*) as cnt FROM KeywordRadarSeen WHERE digestDate = ?`,
              digestDate
            )
          : [{ cnt: 0 }]
        return {
          id: post.id,
          title: post.title,
          publishedAt: post.publishedAt,
          digestDate,
          itemCount: Number(itemCountRows[0]?.cnt || 0),
        }
      })
    )

    return NextResponse.json({ digests })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
