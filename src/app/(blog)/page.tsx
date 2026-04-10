import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { FeedTabs } from '@/components/blog/FeedTabs'
import { FriendCircleList } from '@/components/blog/FriendCircleList'
import { QuickPost } from '@/components/blog/QuickPost'
import { getSession } from '@/lib/auth'
import { stripMarkdown, extractQuotes, extractImages } from '@/lib/post-utils'
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

  // 博友圈 Tab —— 使用客户端组件异步加载，避免阻塞页面渲染
  if (tab === 'friends' && enableFriendCircle) {
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
        <FriendCircleList />
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
    images: extractImages(p.content),
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
