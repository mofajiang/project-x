import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { fetchFriendFeeds, type FriendFeedSource } from '@/lib/rss-fetcher'

// 1 小时重新验证
export const revalidate = 3600
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await runMigrations()

    // 检查博友圈是否启用
    const cfgRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(enableFriendCircle, 0) as enableFriendCircle FROM SiteConfig WHERE id = 'singleton'`
    )
    if (!cfgRows.length || !Number(cfgRows[0].enableFriendCircle)) {
      return NextResponse.json({ enabled: false, items: [] })
    }

    // 取所有已审批、有 rssUrl 的友链（也包括没填 rssUrl 的，让 fetcher 自动发现）
    const links = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, url, COALESCE(rssUrl,'') as rssUrl, COALESCE(favicon,'') as favicon
       FROM FriendLink
       WHERE status = 'approved'
       ORDER BY sortOrder DESC, createdAt ASC`
    )

    const sources: FriendFeedSource[] = links.map((l: any) => ({
      name: l.name as string,
      url: l.url as string,
      rssUrl: (l.rssUrl as string) || undefined,
      favicon: (l.favicon as string) || undefined,
    }))

    const items = await fetchFriendFeeds(sources)

    return NextResponse.json(
      { enabled: true, items },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    )
  } catch (e) {
    console.error('[friends-feed]', e)
    return NextResponse.json({ enabled: false, items: [], error: String(e) }, { status: 500 })
  }
}
