'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { InternalQuoteCard, ExternalQuoteCard } from './QuoteCard'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string | null
  publishedAt: Date | null
  views: number
  likes: number
  author: { username: string; displayName?: string | null; avatar: string | null }
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count: { comments: number }
}

interface QuoteSegment {
  type: 'internal' | 'external'
  value: string
}

function extractQuotes(md: string): QuoteSegment[] {
  const results: QuoteSegment[] = []
  for (const line of md.split('\n')) {
    const internal = line.match(/^::quote\[([^\]]+)\]\s*$/)
    if (internal) { results.push({ type: 'internal', value: internal[1].trim() }); continue }
    const external = line.match(/^::quote-url\[([^\]]+)\]\s*$/)
    if (external) {
      const url = external[1].trim().match(/^(\S+)/)?.[1] || external[1].trim()
      results.push({ type: 'external', value: url })
    }
  }
  return results
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^::quote-url\[[^\]]+\]\s*$/gm, '')
    .replace(/^::quote\[[^\]]+\]\s*$/gm, '')
    .replace(/```[\s\S]*?```/g, '[代码]')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function PostCard({ post }: { post: Post }) {
  const [likes, setLikes] = useState(post.likes)
  const [liked, setLiked] = useState(false)
  const [liking, setLiking] = useState(false)

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
    <article className="post-card px-4 py-5 transition-all duration-200 cursor-pointer" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href={`/post/${post.slug}`} prefetch={true} className="block">
        {/* 作者行 */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-secondary)', outline: '1px solid var(--border)' }}>
            {post.author.avatar
              ? <Image src={post.author.avatar} alt={post.author.username} width={36} height={36} className="object-cover w-full h-full" />
              : <div className="w-full h-full flex items-center justify-center text-base font-bold" style={{ color: 'var(--text-secondary)' }}>{post.author.username[0]?.toUpperCase()}</div>
            }
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{post.author.displayName || post.author.username}</span>
            {/* 认证徽章 */}
            <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)">
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C1.88 9.33 1 10.57 1 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.8c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.07-1.73l-3.5 4.67a.75.75 0 01-1.14.09l-2-2a.75.75 0 011.06-1.06l1.41 1.41 2.96-3.95a.75.75 0 011.21.84z"/>
            </svg>
            <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>@{post.author.username}</span>
            <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>· {post.publishedAt ? relativeTime(post.publishedAt) : '草稿'}</span>
          </div>
        </div>

        {/* 标题 */}
        <h2 className="font-bold text-[15px] mb-1.5 leading-snug" style={{ color: 'var(--text-primary)' }}>
          {post.title}
        </h2>

        {/* 正文内容预览（类 X 推文直接展示） */}
        {post.content && (() => {
          const plainText = stripMarkdown(post.content).trim()
          const quotes = extractQuotes(post.content)
          return (
            <>
              {plainText && (
                <p className="text-sm leading-relaxed mt-1.5 line-clamp-5 whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
                  {plainText}
                </p>
              )}
              {quotes.map((q, i) =>
                q.type === 'internal'
                  ? <InternalQuoteCard key={i} slug={q.value} />
                  : <ExternalQuoteCard key={i} url={q.value} />
              )}
            </>
          )
        })()}

        {/* 封面大图（无封面缩略图时全宽展示） */}
        {post.coverImage && (
          <div className="mt-2.5 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <Image src={post.coverImage} alt={post.title} width={560} height={280} className="object-cover w-full" style={{ maxHeight: 280 }} />
          </div>
        )}

        {/* 标签 */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map(({ tag }) => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--accent)' }}>#{tag.name}</span>
            ))}
          </div>
        )}

        {/* 操作栏 */}
        <div className="flex items-center gap-1 mt-3 -ml-2">
          <span className="flex items-center gap-1.5 text-[13px] px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {post._count.comments}
          </span>
          <button
            onClick={handleLike}
            disabled={liking}
            className="flex items-center gap-1.5 text-[13px] px-2 py-1 rounded-full transition-colors"
            style={{
              color: liked ? '#F91880' : 'var(--text-secondary)',
              background: liked ? 'rgba(249,24,128,0.08)' : 'transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? '#F91880' : 'none'} stroke={liked ? '#F91880' : 'currentColor'} strokeWidth="1.75">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {likes}
          </button>
          <span className="flex items-center gap-1.5 text-[13px] px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {post.views}
          </span>
        </div>
      </Link>
    </article>
  )
}
