import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { formatDate, relativeTime } from '@/lib/utils'
import { PostActions } from '@/components/blog/PostActions'
import { CommentSection } from '@/components/blog/CommentSection'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import { getSession } from '@/lib/auth'
import { getSiteConfig } from '@/lib/config'
import Image from 'next/image'


function buildSlugCandidates(input: string) {
  const set = new Set<string>()
  const raw = (input || '').trim()
  if (!raw) return []

  set.add(raw)
  try {
    set.add(decodeURIComponent(raw))
  } catch {}
  try {
    set.add(encodeURIComponent(raw))
  } catch {}

  for (const value of Array.from(set)) {
    set.add(value.normalize('NFC'))
    set.add(value.normalize('NFD'))
  }

  return Array.from(set).filter(Boolean)
}

const getPost = cache(async (slugCandidates: string[], requirePublished: boolean) => {
  return prisma.post.findFirst({
    where: {
      slug: { in: slugCandidates },
      ...(requirePublished ? { published: true } : {}),
    },
    include: {
      author: { select: { username: true, avatar: true, bio: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true } },
    },
  })
})

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const slugCandidates = buildSlugCandidates(params.slug)
  const post = await getPost(slugCandidates, true)
  if (!post) return {}
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const ogImage = post.coverImage || `${baseUrl}/api/og/${encodeURIComponent(post.slug)}`
  return {
    title: post.title,
    description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
    openGraph: {
      title: post.title,
      description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
      type: 'article',
      url: `${baseUrl}/post/${post.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author.username],
      tags: post.tags.map(t => t.tag.name),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
      images: [ogImage],
    },
    alternates: {
      canonical: `${baseUrl}/post/${post.slug}`,
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const config = await getSiteConfig()
  const slugCandidates = buildSlugCandidates(params.slug)
  const session = await getSession()
  const post = await getPost(slugCandidates, !session)
  if (!post || (!post.published && !session)) notFound()

  const postWithDisplay = { ...post, author: { ...post.author, displayName: post.author.displayName || '' } }

  // 浏览量非阻塞更新，不等待结果
  prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {})

  // 并行获取 session 和评论
  const [, commentsRaw] = await Promise.all([
    Promise.resolve(session),
    prisma.comment.findMany({
      where: { postId: post.id, approved: true, parentId: null },
      include: {
        author: { select: { username: true, avatar: true } },
        replies: {
          where: { approved: true },
          include: { author: { select: { username: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = commentsRaw as any[]

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
    author: { '@type': 'Person', name: postWithDisplay.author.displayName || post.author.username },
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: `${baseUrl}/post/${post.slug}`,
    ...(post.coverImage ? { image: post.coverImage } : {}),
  }

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* 返回导航 */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 backdrop-blur-md" style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" aria-label="返回首页" className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <span className="font-bold text-[17px]" style={{ color: 'var(--text-primary)' }}>文章</span>
      </div>

      <article className="px-4 pt-6">
        {/* 作者信息 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-base" style={{ background: 'var(--bg-secondary)', outline: '1px solid var(--border)' }}>
            {postWithDisplay.author.avatar
              ? <Image src={postWithDisplay.author.avatar} alt={postWithDisplay.author.username} width={44} height={44} className="object-cover w-full h-full" />
              : <span style={{ color: 'var(--text-secondary)' }}>{postWithDisplay.author.username[0]?.toUpperCase()}</span>
            }
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>{postWithDisplay.author.displayName || postWithDisplay.author.username}</p>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" className="flex-shrink-0">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z"/>
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>@{postWithDisplay.author.username}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {post.publishedAt ? formatDate(post.publishedAt) : ''}
            </p>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{post.title}</h1>

        {/* 封面图 */}
        {post.coverImage && (
          <div className="rounded-2xl overflow-hidden mb-4">
            <Image src={post.coverImage} alt={post.title} width={600} height={300} sizes="(max-width: 640px) 100vw, 600px" className="w-full object-cover" />
          </div>
        )}

        {/* 标签 */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {post.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/tag/${tag.slug}`}
                className="text-sm px-3 py-1 rounded-full transition-opacity hover:opacity-80"
                style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--accent)', border: '1px solid rgba(29,155,240,0.2)' }}>
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* 正文 */}
        <div className="mb-6">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* 时间 & 浏览 */}
        <div className="flex items-center gap-4 py-3 border-y text-sm -mx-4 px-4" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <span>{post.publishedAt ? formatDate(post.publishedAt) : ''}</span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {post.views + 1} 次浏览
          </span>
        </div>

        {/* 操作栏 */}
        <PostActions postId={post.id} likes={post.likes} commentCount={post._count.comments} />
      </article>

      {/* 评论区 */}
      <CommentSection postId={post.id} comments={comments} session={session} showCommentIp={!!config.showCommentIp} />
    </div>
  )
}