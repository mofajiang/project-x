import { prisma } from '@/lib/prisma'

export const revalidate = 60

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { posts: { _count: 'desc' } },
  })

  return (
    <div>
      <div
        className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          标签
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          共 {tags.length} 个标签
        </p>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-5">
        {tags.map((tag) => (
          <a
            key={tag.id}
            href={`/tag/${tag.slug}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity active:opacity-60"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--accent)' }}>#{tag.name}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-bold"
              style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
            >
              {tag._count.posts}
            </span>
          </a>
        ))}
        {tags.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>暂无标签</p>}
      </div>
    </div>
  )
}
