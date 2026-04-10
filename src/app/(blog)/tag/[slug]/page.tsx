import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import { stripMarkdown, extractQuotes } from '@/lib/post-utils'
import { buildSlugCandidates } from '@/lib/slug'
import { runMigrations } from '@/lib/db-migrate'

export const revalidate = 60

export default async function TagPage({ params }: { params: { slug: string } }) {
  await runMigrations()
  const slugCandidates = buildSlugCandidates(params.slug)
  const tag = await prisma.tag.findFirst({
    where: { slug: { in: slugCandidates } },
    include: {
      posts: {
        where: { post: { published: true } },
        include: {
          post: {
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
              tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
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
    content: undefined,
    plainText: stripMarkdown(post.content).trim(),
    quotes: extractQuotes(post.content),
    author: { ...post.author, displayName: post.author.displayName || '' },
  }))

  return (
    <div>
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <Link
          href="/"
          aria-label="返回首页"
          className="rounded-full p-2 transition-colors hover:bg-x-bg-hover"
          style={{ color: 'var(--text-primary)' }}
        >
          ←
        </Link>
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            #{tag.name}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {tag.posts.length} 篇文章
          </p>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {postsWithDisplay.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
