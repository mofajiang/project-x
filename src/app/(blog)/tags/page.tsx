import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { posts: { _count: 'desc' } },
  })

  return (
    <div>
      <div className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md" style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>标签</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>共 {tags.length} 个标签</p>
      </div>
      <div className="px-4 py-6 flex flex-wrap gap-3">
        {tags.map(tag => (
          <a
            key={tag.id}
            href={`/tag/${tag.slug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--accent)' }}>#{tag.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>{tag._count.posts}</span>
          </a>
        ))}
        {tags.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>暂无标签</p>
        )}
      </div>
    </div>
  )
}
