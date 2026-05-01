import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { FeedTabs } from '@/components/blog/FeedTabs'
import { FriendCircleList } from '@/components/blog/FriendCircleList'
import { QuickPost } from '@/components/blog/QuickPost'
import { getSession } from '@/lib/auth'
import { stripMarkdown, extractQuotes, extractImages } from '@/lib/post-utils'

export default async function HomePage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab || 'latest'
  const session = await getSession()
  let avatar: string | null = null

  // 检查博友圈开关
  let enableFriendCircle = false
  try {
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

  // 排除 Thread 中序号非最小的续集帖子，每个 Thread 只在首页展示第一条
  let excludePostIds: string[] = []
  try {
    const excludeRows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT p.id FROM Post p
      WHERE p.threadId IS NOT NULL
        AND p.threadOrder > (SELECT MIN(p2.threadOrder) FROM Post p2 WHERE p2.threadId = p.threadId AND p2.published = 1)
        AND p.published = 1
    `)
    excludePostIds = excludeRows.map((r) => r.id)
  } catch {}

  const posts = await prisma.post.findMany({
    where: {
      published: true,
      ...(excludePostIds.length > 0 ? { id: { notIn: excludePostIds } } : {}),
    },
    orderBy: tab === 'hot' ? [{ pinned: 'desc' }, { views: 'desc' }] : [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      publicId: true,
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

  // 获取每篇文章的 threadId / threadOrder，以及各 thread 的帖子数
  let threadMap = new Map<string, { threadId: string | null; threadOrder: number; reposts: number }>()
  let threadCountMap = new Map<string, number>()
  try {
    const postIds = posts.map((p) => p.id)
    if (postIds.length > 0) {
      const threadRows = await prisma.$queryRawUnsafe<
        { id: string; threadId: string | null; threadOrder: number; reposts: number }[]
      >(
        `SELECT id, threadId, threadOrder, COALESCE(reposts, 0) as reposts FROM Post WHERE id IN (${postIds.map(() => '?').join(',')})`,
        ...postIds
      )
      threadMap = new Map(
        threadRows.map((r) => [
          r.id,
          { threadId: r.threadId, threadOrder: Number(r.threadOrder), reposts: Number(r.reposts) },
        ])
      )
      const threadIds = Array.from(new Set(threadRows.filter((r) => r.threadId).map((r) => r.threadId as string)))
      if (threadIds.length > 0) {
        const counts = await prisma.$queryRawUnsafe<{ threadId: string; count: number }[]>(
          `SELECT threadId, COUNT(*) as count FROM Post WHERE threadId IN (${threadIds.map(() => '?').join(',')}) AND published = 1 GROUP BY threadId`,
          ...threadIds
        )
        threadCountMap = new Map(counts.map((r) => [r.threadId, Number(r.count)]))
      }
    }
  } catch {}

  const postsWithDisplay = posts.map((p) => {
    const tinfo = threadMap.get(p.id)
    return {
      ...p,
      content: undefined,
      plainText: stripMarkdown(p.content).trim(),
      quotes: extractQuotes(p.content),
      images: extractImages(p.content),
      author: { ...p.author, displayName: p.author.displayName || '' },
      threadId: tinfo?.threadId || null,
      threadOrder: tinfo?.threadOrder || 0,
      threadCount: tinfo?.threadId ? threadCountMap.get(tinfo.threadId) || 1 : null,
      reposts: Number(tinfo?.reposts) || 0,
    }
  })

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
