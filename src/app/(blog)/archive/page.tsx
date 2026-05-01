import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { getPostPath } from '@/lib/post-link'

export const revalidate = 60

export default async function ArchivePage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      publicId: true,
      title: true,
      slug: true,
      publishedAt: true,
      author: { select: { username: true } },
    },
  })

  // 按年月分组
  const grouped: Record<string, typeof posts> = {}
  for (const post of posts) {
    const key = post.publishedAt ? format(post.publishedAt, 'yyyy年MM月', { locale: zhCN }) : '未发布'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(post)
  }

  return (
    <div>
      <div
        className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          归档
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          共 {posts.length} 篇文章
        </p>
      </div>
      <div className="px-4 py-4">
        {Object.entries(grouped).map(([month, monthPosts]) => (
          <div key={month} className="mb-8">
            <h2 className="mb-3 text-lg font-bold" style={{ color: 'var(--accent)' }}>
              {month}
            </h2>
            <div className="flex flex-col gap-0 pl-4" style={{ borderLeft: '2px solid var(--accent)', opacity: 0.7 }}>
              {monthPosts.map((post) => (
                <a
                  key={post.id}
                  href={getPostPath(post)}
                  className="group flex items-center justify-between py-2 transition-opacity active:opacity-60"
                >
                  <span
                    className="min-w-0 flex-1 truncate pr-2 text-sm group-hover:underline"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {post.title}
                  </span>
                  <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {post.publishedAt ? formatDate(post.publishedAt) : ''}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
