import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { PostActions } from '@/components/blog/PostActions'
import { CommentSection } from '@/components/blog/CommentSection'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import { getSiteConfig } from '@/lib/config'
import { buildSlugCandidates } from '@/lib/slug'
import Image from 'next/image'
import { extractImages } from '@/lib/post-utils'
import { MomentsImageGrid } from '@/components/blog/MomentsImageGrid'
import { getPostPath, getPostUrl } from '@/lib/post-link'

const getPostBySlugCached = cache(async (slugKey: string, requirePublished: boolean) => {
  const slugCandidates = buildSlugCandidates(slugKey)
  return prisma.post.findFirst({
    where: {
      slug: { in: slugCandidates },
      ...(requirePublished ? { published: true } : {}),
    },
    include: {
      author: { select: { username: true, avatar: true, bio: true, displayName: true } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { comments: true } },
    },
  })
})

const getPostByPublicIdCached = cache(async (publicId: number, username: string, requirePublished: boolean) => {
  return prisma.post.findFirst({
    where: {
      publicId,
      author: { username },
      ...(requirePublished ? { published: true } : {}),
    },
    include: {
      author: { select: { username: true, avatar: true, bio: true, displayName: true } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { comments: true } },
    },
  })
})

export async function getPostBySlug(slug: string, requirePublished: boolean) {
  return getPostBySlugCached(slug, requirePublished)
}

export async function getPostByPublicId(publicId: number, username: string, requirePublished: boolean) {
  return getPostByPublicIdCached(publicId, username, requirePublished)
}

type LoadedPost = NonNullable<Awaited<ReturnType<typeof getPostBySlug>>>

export function buildPostMetadata(post: LoadedPost) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const ogImage = post.coverImage || `${baseUrl}/api/og/${encodeURIComponent(post.slug)}`
  const postUrl = getPostUrl(post, baseUrl)
  return {
    title: post.title,
    description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
    openGraph: {
      title: post.title,
      description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
      type: 'article',
      url: postUrl,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author.username],
      tags: post.tags.map((t) => t.tag.name),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
      images: [ogImage],
    },
    alternates: {
      canonical: postUrl,
    },
  }
}

export async function renderPostPage(post: LoadedPost, session: { userId: string; username: string } | null) {
  const config = await getSiteConfig()
  const postWithDisplay = { ...post, author: { ...post.author, displayName: post.author.displayName || '' } }

  type ThreadPost = {
    id: string
    slug: string
    title: string
    content: string
    threadOrder: number
    publicId: number | null
    username: string
  }

  let threadPosts: ThreadPost[] = []
  try {
    const threadRow = await prisma.$queryRawUnsafe<{ threadId: string | null; threadOrder: number }[]>(
      `SELECT threadId, threadOrder FROM Post WHERE id = ?`,
      post.id
    )
    const threadId = threadRow[0]?.threadId
    if (threadId) {
      threadPosts = await prisma.$queryRawUnsafe<ThreadPost[]>(
        `SELECT p.id, p.slug, p.title, p.content, p.threadOrder, p.publicId, u.username
         FROM Post p
         JOIN User u ON u.id = p.authorId
         WHERE p.threadId = ? AND p.published = 1
         ORDER BY p.threadOrder ASC, p.publishedAt ASC`,
        threadId
      )
    }
  } catch {}

  prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {})

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
  const comments = commentsRaw as any[]

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const postUrl = getPostUrl(post, baseUrl)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || post.content.slice(0, 160).replace(/[#*`]/g, ''),
    author: { '@type': 'Person', name: postWithDisplay.author.displayName || post.author.username },
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: postUrl,
    ...(post.coverImage ? { image: post.coverImage } : {}),
  }

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <Link
          href="/"
          aria-label="返回首页"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
          文章
        </span>
      </div>

      <article className="px-4 pt-6">
        {threadPosts.length > 1 ? (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h16v2H4V4zm2 4h12v2H6V8zm-2 4h16v2H4v-2zm2 4h12v2H6v-2z" />
              </svg>
              Thread · {threadPosts.length} 条
            </div>

            {threadPosts.map((tp, i) => {
              const isCurrent = tp.id === post.id
              const isLast = i === threadPosts.length - 1
              const previewText = tp.content
                .replace(/<[^>]*>/g, '')
                .replace(/[#*`[\]!]/g, '')
                .trim()
                .slice(0, 150)

              return (
                <div key={tp.id} className="flex gap-3">
                  <div className="flex w-10 flex-shrink-0 flex-col items-center">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                      style={{
                        background: 'var(--bg-secondary)',
                        boxShadow: '0 0 0 1px var(--border)',
                        ...(isCurrent ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}),
                      }}
                    >
                      {postWithDisplay.author.avatar ? (
                        <Image
                          src={postWithDisplay.author.avatar}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {postWithDisplay.author.username[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {!isLast && (
                      <div className="my-1 w-0.5 flex-1" style={{ background: 'var(--border)', minHeight: 20 }} />
                    )}
                  </div>

                  <div className={`min-w-0 flex-1 ${isLast ? 'pb-2' : 'pb-5'}`}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0">
                      <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {postWithDisplay.author.displayName || postWithDisplay.author.username}
                      </span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--accent)" className="flex-shrink-0">
                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z" />
                      </svg>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        @{postWithDisplay.author.username}
                      </span>
                      {isCurrent && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
                        >
                          当前
                        </span>
                      )}
                    </div>

                    {isCurrent ? (
                      <>
                        {post.title && (
                          <h1 className="mb-3 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {post.title}
                          </h1>
                        )}
                        {post.coverImage && extractImages(post.content).length === 0 && (
                          <div className="mb-5 aspect-[16/9] overflow-hidden rounded-2xl">
                            <Image
                              src={post.coverImage}
                              alt={post.title}
                              width={600}
                              height={338}
                              sizes="(max-width: 640px) 100vw, 600px"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        {post.tags.length > 0 && (
                          <div className="mb-5 flex flex-wrap gap-2">
                            {post.tags.map(({ tag }) => (
                              <Link
                                key={tag.id}
                                href={`/tag/${tag.slug}`}
                                className="rounded-full px-3 py-1 text-sm transition-opacity hover:opacity-80"
                                style={{
                                  background: 'rgba(29,155,240,0.1)',
                                  color: 'var(--accent)',
                                  border: '1px solid rgba(29,155,240,0.2)',
                                }}
                              >
                                #{tag.name}
                              </Link>
                            ))}
                          </div>
                        )}
                        <div className="mb-6">
                          <MarkdownRenderer
                            content={
                              post.content.trimStart().startsWith('<')
                                ? post.content.replace(/<img[^>]*>/gi, '')
                                : post.content
                                    .replace(/!\[.*?\]\(https?:\/\/[^)\s]+\)/g, '')
                                    .replace(/<img[^>]*>/gi, '')
                            }
                          />
                        </div>
                        {extractImages(post.content).length > 0 && (
                          <div className="mb-6">
                            <MomentsImageGrid images={extractImages(post.content)} title={post.title} priority />
                          </div>
                        )}
                        <div
                          className="-mx-4 flex items-center gap-4 border-y px-4 py-3 text-sm"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                          <span>{post.publishedAt ? formatDate(post.publishedAt) : ''}</span>
                          <span className="flex items-center gap-1">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            {post.views + 1} 次浏览
                          </span>
                        </div>
                        <PostActions postId={post.id} likes={post.likes} commentCount={post._count.comments} />
                      </>
                    ) : (
                      <Link
                        href={getPostPath({ slug: tp.slug, publicId: tp.publicId, username: tp.username })}
                        className="group block"
                      >
                        {tp.title && (
                          <p
                            className="mb-1 text-[15px] font-semibold group-hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {tp.title}
                          </p>
                        )}
                        {previewText && (
                          <p className="line-clamp-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {previewText.length >= 150 ? previewText + '…' : previewText}
                          </p>
                        )}
                        <span className="mt-1 block text-xs" style={{ color: 'var(--accent)' }}>
                          查看全文 →
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold"
                style={{ background: 'var(--bg-secondary)', boxShadow: '0 0 0 1px var(--border)' }}
              >
                {postWithDisplay.author.avatar ? (
                  <Image
                    src={postWithDisplay.author.avatar}
                    alt={postWithDisplay.author.username}
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {postWithDisplay.author.username[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {postWithDisplay.author.displayName || postWithDisplay.author.username}
                  </p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" className="flex-shrink-0">
                    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z" />
                  </svg>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    @{postWithDisplay.author.username}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {post.publishedAt ? formatDate(post.publishedAt) : ''}
                </p>
              </div>
            </div>

            <h1 className="mb-3 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {post.title}
            </h1>

            {post.coverImage && extractImages(post.content).length === 0 && (
              <div className="mb-5 aspect-[16/9] overflow-hidden rounded-2xl">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  width={600}
                  height={338}
                  sizes="(max-width: 640px) 100vw, 600px"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {post.tags.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {post.tags.map(({ tag }) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="rounded-full px-3 py-1 text-sm transition-opacity hover:opacity-80"
                    style={{
                      background: 'rgba(29,155,240,0.1)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(29,155,240,0.2)',
                    }}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="mb-6">
              <MarkdownRenderer
                content={
                  post.content.trimStart().startsWith('<')
                    ? post.content.replace(/<img[^>]*>/gi, '')
                    : post.content.replace(/!\[.*?\]\(https?:\/\/[^)\s]+\)/g, '').replace(/<img[^>]*>/gi, '')
                }
              />
            </div>

            {extractImages(post.content).length > 0 && (
              <div className="mb-6">
                <MomentsImageGrid images={extractImages(post.content)} title={post.title} priority />
              </div>
            )}

            <div
              className="-mx-4 flex items-center gap-4 border-y px-4 py-3 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <span>{post.publishedAt ? formatDate(post.publishedAt) : ''}</span>
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {post.views + 1} 次浏览
              </span>
            </div>

            <PostActions postId={post.id} likes={post.likes} commentCount={post._count.comments} />
          </>
        )}
      </article>

      <div id="comments" className="scroll-mt-24">
        <CommentSection postId={post.id} comments={comments} session={session} showCommentIp={!!config.showCommentIp} />
      </div>
    </div>
  )
}

export function ensurePostFound<T>(post: T | null | undefined): T {
  if (!post) notFound()
  return post
}
