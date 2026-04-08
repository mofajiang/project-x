import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { FeedTabs } from '@/components/blog/FeedTabs'
import { QuickPost } from '@/components/blog/QuickPost'
import { getSession } from '@/lib/auth'
import { stripMarkdown, extractQuotes } from '@/lib/post-utils'


export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab = searchParams.tab || 'latest'
  const session = await getSession()
  let avatar: string | null = null

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: tab === 'hot'
      ? [{ pinned: 'desc' }, { views: 'desc' }]
      : [{ pinned: 'desc' }, { publishedAt: 'desc' }],
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
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT avatar FROM User WHERE id = ?`, session.userId
      )
      avatar = rows[0]?.avatar || null
    } catch {}
  }
  const postsWithDisplay = posts.map(p => ({
    ...p,
    content: undefined,
    plainText: stripMarkdown(p.content).trim(),
    quotes: extractQuotes(p.content),
    author: { ...p.author, displayName: p.author.displayName || '' },
  }))

  return (
    <div>
      <FeedTabs active={tab} />
      {session && (
        <QuickPost avatar={avatar} username={session.username} />
      )}
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
