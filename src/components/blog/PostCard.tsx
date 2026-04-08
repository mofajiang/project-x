'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useMemo, memo } from 'react'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { InternalQuoteCard, ExternalQuoteCard } from './QuoteCard'
import { extractQuotes as extractQuotesFn, stripMarkdown as stripMarkdownFn, type QuoteSegment } from '@/lib/post-utils'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string
  content?: string
  coverImage: string | null
  publishedAt: Date | null
  pinned?: boolean
  views: number
  likes: number
  author: { username: string; displayName?: string | null; avatar: string | null }
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count: { comments: number }
  plainText?: string
  quotes?: QuoteSegment[]
}

interface PostCardProps {
  post: Post & { authorId?: string }
  currentUserId?: string
  index?: number
}

export const PostCard = memo(function PostCard({ post, currentUserId, index = 0 }: PostCardProps) {
  const [likes, setLikes] = useState(post.likes)
  const [liked, setLiked] = useState(false)
  const [liking, setLiking] = useState(false)
  const isAuthor = currentUserId && post.authorId && currentUserId === post.authorId
  const plainText = useMemo(
    () => post.plainText ?? (post.content ? stripMarkdownFn(post.content).trim() : ''),
    [post.plainText, post.content]
  )
  const quotes = useMemo(
    () => post.quotes ?? (post.content ? extractQuotesFn(post.content) : []),
    [post.quotes, post.content]
  )

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (liking || liked) return
    setLiking(true)
    const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
    setLiking(false)
    if (res.ok) {
      const data = await res.json()
      setLikes(data.likes)
      setLiked(true)
    } else if (res.status === 429) {
      toast.error('操作太频繁，请稍后再试')
    }
  }

  return (
    <article
      className="post-card cursor-pointer px-4 py-5 transition-all duration-200 active:scale-[0.99] active:opacity-90"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <Link href={`/post/${post.slug}`} prefetch={index < 3} className="block">
        {/* 作者行 */}
        <div className="mb-2.5 flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full"
              style={{ background: 'var(--bg-secondary)', boxShadow: '0 0 0 1px var(--border)' }}
            >
              {post.author.avatar ? (
                <Image
                  src={post.author.avatar}
                  alt={post.author.username}
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                  sizes="36px"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-base font-bold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {post.author.username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {post.author.displayName || post.author.username}
              </span>
              {/* 认证徽章 */}
              <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z" />
              </svg>
              <span className="flex-shrink-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                @{post.author.username}
              </span>
              <span className="flex-shrink-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                · {post.publishedAt ? relativeTime(post.publishedAt) : '草稿'}
              </span>
            </div>
          </div>
          {isAuthor && (
            <Link
              href={`/admin/posts/${post.id}`}
              className="flex-shrink-0 rounded-full p-2 transition-colors hover:bg-white/10"
              title="编辑此文章"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </Link>
          )}
        </div>

        {/* 标题 + 置顶图标 */}
        <div className="mb-1.5 flex items-center gap-2">
          {post.pinned && (
            <span title="置顶" style={{ color: 'var(--accent)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 3a1 1 0 0 1 .707 1.707L15 6.414l.293.293a1 1 0 0 1 0 1.414l-3 3A1 1 0 0 1 11 11H9.414l-5.707 5.707a1 1 0 0 1-1.414-1.414L8 9.586V8a1 1 0 0 1 .293-.707l3-3a1 1 0 0 1 1.414 0l.293.293L14.293 2.293A1 1 0 0 1 16 3z" />
              </svg>
            </span>
          )}
          <h2 className="text-[15px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {post.title}
          </h2>
        </div>

        {/* 正文内容预览（类 X 推文直接展示） */}
        {(plainText || quotes.length > 0) && (
          <>
            {plainText && (
              <p
                className="mt-1.5 line-clamp-5 whitespace-pre-line text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {plainText}
              </p>
            )}
            {quotes.map((q, i) =>
              q.type === 'internal' ? (
                <InternalQuoteCard key={i} slug={q.value} />
              ) : (
                <ExternalQuoteCard key={i} url={q.value} />
              )
            )}
          </>
        )}

        {/* 封面大图（无封面缩略图时全宽展示） */}
        {post.coverImage && (
          <div
            className="mt-2.5 aspect-[16/9] overflow-hidden rounded-2xl"
            style={{ border: '1px solid var(--border)' }}
          >
            <Image
              src={post.coverImage}
              alt={post.title}
              width={560}
              height={315}
              className="h-full w-full object-cover"
              priority={index < 2}
              sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(100vw - 120px), 600px"
              quality={85}
            />
          </div>
        )}

        {/* 标签 */}
        {post.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {post.tags.map(({ tag }) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full px-2 py-1 text-xs transition-opacity active:opacity-60"
                style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--accent)' }}
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* 操作栏 */}
        <div className="-ml-2 mt-3 flex items-center gap-1">
          <span className="flex items-center gap-1.5 px-3 py-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post._count.comments}
          </span>
          <button
            onClick={handleLike}
            disabled={liking}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] transition-colors"
            style={{
              color: liked ? '#F91880' : 'var(--text-secondary)',
              background: liked ? 'rgba(249,24,128,0.08)' : 'transparent',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={liked ? '#F91880' : 'none'}
              stroke={liked ? '#F91880' : 'currentColor'}
              strokeWidth="1.75"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likes}
          </button>
          <span className="flex items-center gap-1.5 px-3 py-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {post.views}
          </span>
        </div>
      </Link>
    </article>
  )
})
