import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { FeedTabs } from '@/components/blog/FeedTabs'
import { FriendFeedCard } from '@/components/blog/FriendFeedCard'
import { QuickPost } from '@/components/blog/QuickPost'
import { getSession } from '@/lib/auth'
import { stripMarkdown, extractQuotes } from '@/lib/post-utils'
import { fetchFriendFeeds, type FriendFeedSource } from '@/lib/rss-fetcher'
import { runMigrations } from '@/lib/db-migrate'

export default async function HomePage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab || 'latest'
  const session = await getSession()
  let avatar: string | null = null

  // 检查博友圈开关
  let enableFriendCircle = false
  try {
    await runMigrations()
    const cfgRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(enableFriendCircle, 0) as enableFriendCircle FROM SiteConfig WHERE id = 'singleton'`
    )
    enableFriendCircle = cfgRows.length > 0 && Boolean(Number(cfgRows[0].enableFriendCircle))
  } catch {}

  // 博友圈 Tab
  if (tab === 'friends' && enableFriendCircle) {
    const links = await prisma
      .$queryRawUnsafe<any[]>(
        `SELECT name, url, COALESCE(rssUrl,'') as rssUrl, COALESCE(favicon,'') as favicon
       FROM FriendLink WHERE status = 'approved' ORDER BY sortOrder DESC, createdAt ASC`
      )
      .catch(() => [])

    const sources: FriendFeedSource[] = (links as any[]).map((l) => ({
      name: l.name as string,
      url: l.url as string,
      rssUrl: (l.rssUrl as string) || undefined,
      favicon: (l.favicon as string) || undefined,
    }))

    const items = await fetchFriendFeeds(sources)

    if (session) {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT avatar FROM User WHERE id = ?`, session.userId)
        avatar = rows[0]?.avatar || null
      } catch {}
    }

    return (
      <div>
        <FeedTabs active={tab} showFriendCircle={enableFriendCircle} />
        {session && <QuickPost avatar={avatar} username={session.username} />}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {items.length === 0 ? (
            <div className="py-20 text-center" style={{ color: 'var(--text-secondary)' }}>
              暂无博友圈内容，请先在后台为友链添加 RSS 地址，并确保博友圈功能已启用。
            </div>
          ) : (
            items.map((item, i) => <FriendFeedCard key={`${item.link}-${i}`} item={item} />)
          )}
        </div>
      </div>
    )
  }

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: tab === 'hot' ? [{ pinned: 'desc' }, { views: 'desc' }] : [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      pinned: true,
      views: true,
      likes: true,
      authorId: true,
      author: { select: { username: true, avatar: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true } },
    },
    take: 20,
  })
  if (session) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT avatar FROM User WHERE id = ?`, session.userId)
      avatar = rows[0]?.avatar || null
    } catch {}
  }
  const postsWithDisplay = posts.map((p) => ({
    ...p,
    content: undefined,
    plainText: stripMarkdown(p.content).trim(),
    quotes: extractQuotes(p.content),
    author: { ...p.author, displayName: p.author.displayName || '' },
  }))

  return (
    <div>
      <FeedTabs active={tab} showFriendCircle={enableFriendCircle} />
      {session && <QuickPost avatar={avatar} username={session.username} />}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {posts.length === 0 ? (
          <div className="py-20 text-center" style={{ color: 'var(--text-secondary)' }}>
            暂无文章
          </div>
        ) : (
          postsWithDisplay.map((post, index) => (
            <PostCard key={post.id} post={post} currentUserId={session?.userId} index={index} />
          ))
        )}
      </div>
    </div>
  )
}
