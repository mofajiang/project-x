import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    select: { id: true, title: true, slug: true, publishedAt: true },
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
      <div className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md" style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>归档</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>共 {posts.length} 篇文章</p>
      </div>
      <div className="px-4 py-4">
        {Object.entries(grouped).map(([month, monthPosts]) => (
          <div key={month} className="mb-8">
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--accent)' }}>{month}</h2>
            <div className="flex flex-col gap-2 pl-4" style={{ borderLeft: '2px solid var(--border)' }}>
              {monthPosts.map(post => (
                <a key={post.id} href={`/post/${post.slug}`}
                  className="flex items-center justify-between group py-1">
                  <span className="text-sm group-hover:underline" style={{ color: 'var(--text-primary)' }}>{post.title}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{post.publishedAt ? formatDate(post.publishedAt) : ''}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}