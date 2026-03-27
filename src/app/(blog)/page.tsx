import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { FeedTabs } from '@/components/blog/FeedTabs'
import { QuickPost } from '@/components/blog/QuickPost'
import { getSession } from '@/lib/auth'

export const revalidate = 60

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab = searchParams.tab || 'latest'
  const session = await getSession()
  let avatar: string | null = null
  // avatar 在 displayName 批查询中一并获取，此处延迟到后面

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: tab === 'hot' ? { views: 'desc' } : { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      views: true,
      likes: true,
      author: { select: { username: true, avatar: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true } },
    },
    take: 20,
  })
  // 补充 displayName（raw SQL，兼容旧 Prisma client）
  const authorUsernames = Array.from(new Set(posts.map(p => p.author.username)))
  let displayNameMap: Record<string, string> = {}
  if (session) {
    // 同时查当前用户 avatar
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT avatar FROM User WHERE id = ?`, session.userId
      )
      avatar = rows[0]?.avatar || null
    } catch {}
  }
  if (authorUsernames.length > 0) {
    try {
      const placeholders = authorUsernames.map(() => '?').join(',')
      const rows = await prisma.$queryRawUnsafe<{ username: string; displayName: string }[]>(
        `SELECT username, displayName FROM User WHERE username IN (${placeholders})`,
        ...authorUsernames
      )
      displayNameMap = Object.fromEntries(rows.map(r => [r.username, r.displayName]))
    } catch {}
  }
  const postsWithDisplay = posts.map(p => ({
    ...p,
    author: { ...p.author, displayName: displayNameMap[p.author.username] || '' },
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
          postsWithDisplay.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  )
}
