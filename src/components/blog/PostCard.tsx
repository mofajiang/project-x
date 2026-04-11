'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useMemo, memo, useEffect, useRef } from 'react'
import { formatViews, relativeTime } from '@/lib/utils'
import { getPostPath } from '@/lib/post-link'
import toast from 'react-hot-toast'
import { InternalQuoteCard, ExternalQuoteCard } from './QuoteCard'
import { extractQuotes as extractQuotesFn, stripMarkdown as stripMarkdownFn, type QuoteSegment } from '@/lib/post-utils'
import { MomentsImageGrid } from './MomentsImageGrid'

interface Post {
  id: string
  title: string
  slug: string
  publicId?: number | null
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
  images?: string[]
  threadId?: string | null
  threadOrder?: number
  threadCount?: number | null
  reposts?: number
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
  const [likeAnim, setLikeAnim] = useState(false)
  const isAuthor = currentUserId && post.authorId && currentUserId === post.authorId
  const [reposts, setReposts] = useState(post.reposts || 0)
  const [repostOpen, setRepostOpen] = useState(false)
  const [reposting, setReposting] = useState(false)
  const repostContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!repostOpen) return
    const handler = (e: PointerEvent) => {
      if (!repostContainerRef.current?.contains(e.target as Node)) setRepostOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [repostOpen])
  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRepostOpen(false)
    if (!currentUserId) {
      toast.error('请先登录')
      return
    }
    setReposting(true)
    const res = await fetch(`/api/posts/${post.id}/repost`, { method: 'POST' })
    setReposting(false)
    if (res.ok) {
      setReposts((r) => r + 1)
      toast.success('转发成功')
    } else if (res.status === 401) {
      toast.error('请先登录后转发')
    } else {
      toast.error('转发失败')
    }
  }
  const handleQuote = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRepostOpen(false)
    if (!currentUserId) {
      toast.error('请先登录')
      return
    }
    window.dispatchEvent(new CustomEvent('open-compose', { detail: { quoteSlug: post.slug } }))
  }
  const plainText = useMemo(
    () => post.plainText ?? (post.content ? stripMarkdownFn(post.content).trim() : ''),
    [post.plainText, post.content]
  )
  const quotes = useMemo(
    () => post.quotes ?? (post.content ? extractQuotesFn(post.content) : []),
    [post.quotes, post.content]
  )
  const displayText = plainText || post.excerpt || ''

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
      setLikeAnim(true)
    } else if (res.status === 429) {
      toast.error('操作太频繁，请稍后再试')
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}${getPostPath(post)}`
    await navigator.clipboard.writeText(url)
    toast.success('帖子链接已复制')
  }

  return (
    <article
      className="post-card cursor-pointer transition-all duration-200 active:opacity-90"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <Link href={getPostPath(post)} prefetch={index < 3} className="block px-4 py-3">
        <div className="flex gap-3">
          {/* 头像列 */}
          <div className="flex-shrink-0 pt-0.5">
            <div
              className="h-10 w-10 overflow-hidden rounded-full"
              style={{ background: 'var(--bg-secondary)', boxShadow: '0 0 0 1px var(--border)' }}
            >
              {post.author.avatar ? (
                <Image
                  src={post.author.avatar}
                  alt={post.author.username}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  sizes="40px"
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
          </div>

          {/* 内容列 */}
          <div className="min-w-0 flex-1">
            {/* 作者行 */}
            <div className="mb-0.5 flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0">
                <span className="text-[15px] font-bold leading-5" style={{ color: 'var(--text-primary)' }}>
                  {post.author.displayName || post.author.username}
                </span>
                {/* 认证徽章 */}
                <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="var(--accent)">
                  <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z" />
                </svg>
                <span className="text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                  @{post.author.username}
                </span>
                <span className="flex-shrink-0 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                  · {post.publishedAt ? relativeTime(post.publishedAt) : '草稿'}
                </span>
              </div>
              {isAuthor && (
                <Link
                  href={`/admin/posts/${post.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/10"
                  title="编辑此文章"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </Link>
              )}
            </div>

            {/* 标题 + 置顶图标 */}
            {(post.title || post.pinned) && (
              <div className="mb-1 flex items-center gap-1.5">
                {post.pinned && (
                  <span title="置顶" style={{ color: 'var(--accent)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 3a1 1 0 0 1 .707 1.707L15 6.414l.293.293a1 1 0 0 1 0 1.414l-3 3A1 1 0 0 1 11 11H9.414l-5.707 5.707a1 1 0 0 1-1.414-1.414L8 9.586V8a1 1 0 0 1 .293-.707l3-3a1 1 0 0 1 1.414 0l.293.293L14.293 2.293A1 1 0 0 1 16 3z" />
                    </svg>
                  </span>
                )}
                <h2 className="text-[13px] font-medium leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {post.title}
                </h2>
              </div>
            )}

            {/* 正文内容预览 */}
            {(displayText || quotes.length > 0) && (
              <>
                {displayText && (
                  <p
                    className="line-clamp-6 whitespace-pre-line text-[15px] leading-6"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {displayText}
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

            {/* 图片区域 */}
            {post.images && post.images.length > 0 ? (
              <MomentsImageGrid images={post.images} title={post.title} priority={index < 2} />
            ) : post.coverImage ? (
              <div
                className="mt-2 aspect-[16/9] overflow-hidden rounded-2xl"
                style={{ border: '1px solid var(--border)' }}
              >
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  width={520}
                  height={293}
                  className="h-full w-full object-cover"
                  priority={index < 2}
                  sizes="(max-width: 640px) calc(100vw - 80px), (max-width: 1024px) calc(100vw - 160px), 520px"
                  quality={85}
                />
              </div>
            ) : null}

            {/* 标签 */}
            {post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 opacity-90">
                {post.tags.map(({ tag }) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full px-2 py-0.5 text-[11px] transition-opacity active:opacity-60"
                    style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--text-secondary)' }}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Thread 查看链接 */}
            {post.threadId && post.threadCount && post.threadCount > 1 && (
              <div className="mt-2 text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                查看完整 Thread（{post.threadCount} 条）
              </div>
            )}

            {/* 操作栏 */}
            <div className="-ml-2 mt-2 flex items-center justify-between gap-1">
              <span
                className="group flex items-center gap-1 px-2 py-1.5 text-[13px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="rounded-full p-1.5 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                {post._count.comments}
              </span>
              {/* 转发带气泡 */}
              <div className="relative" ref={repostContainerRef}>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setRepostOpen((o) => !o)
                  }}
                  disabled={reposting}
                  className="group flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] transition-colors"
                  style={{ color: repostOpen ? '#00BA7C' : 'var(--text-secondary)' }}
                >
                  <span
                    className={`rounded-full p-1.5 transition-colors ${repostOpen ? 'bg-emerald-500/10 text-emerald-500' : 'group-hover:bg-emerald-500/10 group-hover:text-emerald-500'}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M17 2 21 6l-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 22 3 18l4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </span>
                  {reposts > 0 && <span>{reposts}</span>}
                </button>
                {repostOpen && (
                  <div
                    className="absolute bottom-full left-0 z-50 mb-1.5 overflow-hidden rounded-xl shadow-xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', minWidth: 152 }}
                  >
                    <button
                      onClick={handleRepost}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      >
                        <path d="M17 2 21 6l-4 4" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <path d="M7 22 3 18l4-4" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                      转发
                    </button>
                    <button
                      onClick={handleQuote}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold transition-colors hover:bg-sky-500/10 hover:text-sky-500"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      引用发帖
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleLike}
                disabled={liking}
                className="group flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] transition-colors"
                style={{
                  color: liked ? '#F91880' : 'var(--text-secondary)',
                  background: 'transparent',
                }}
              >
                <span
                  className={`rounded-full p-1.5 transition-colors ${liked ? 'bg-pink-500/10 text-pink-500' : 'group-hover:bg-pink-500/10 group-hover:text-pink-500'} ${likeAnim ? 'like-heart-pop' : ''}`}
                  onAnimationEnd={() => setLikeAnim(false)}
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
                </span>
                {likes}
              </button>
              <span
                className="group flex items-center gap-1 px-2 py-1.5 text-[13px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="rounded-full p-1.5 transition-colors group-hover:bg-white/5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                {formatViews(post.views)}
              </span>
              <button
                onClick={handleShare}
                className="group flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="rounded-full p-1.5 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <path d="M12 16V3" />
                    <path d="m7 8 5-5 5 5" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
})
