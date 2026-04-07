import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'

export const revalidate = 60

export default async function TagPage({ params }: { params: { slug: string } }) {
  const tag = await prisma.tag.findUnique({
    where: { slug: params.slug },
    include: {
      posts: {
        where: { post: { published: true } },
        include: {
          post: {
            include: {
              author: { select: { username: true, avatar: true, displayName: true } },
              tags: { include: { tag: true } },
              _count: { select: { comments: true } },
            },
          },
        },
        orderBy: [{ post: { pinned: 'desc' } }, { post: { publishedAt: 'desc' } }],
      },
    },
  })
  if (!tag) notFound()

  const postsWithDisplay = tag.posts.map(({ post }) => ({
    ...post,
    author: { ...post.author, displayName: post.author.displayName || '' },
  }))

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 backdrop-blur-md" style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="p-2 rounded-full hover:bg-x-bg-hover transition-colors" style={{ color: 'var(--text-primary)' }}>←</Link>
        <div>
          <p className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>#{tag.name}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tag.posts.length} 篇文章</p>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {postsWithDisplay.map((post) => <PostCard key={post.id} post={post as any} />)}
      </div>
    </div>
  )
}
