'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// 客户端模块级缓存，同页面相同 URL 只请求一次
const ogCache = new Map<string, any>()
const ogPending = new Map<string, Promise<any>>()

interface InternalQuoteProps {
  slug: string
}

interface PostPreview {
  title: string
  excerpt: string
  slug: string
  author: { username: string; avatar: string | null }
  publishedAt: string | null
  coverImage: string | null
}

export function InternalQuoteCard({ slug }: InternalQuoteProps) {
  const [post, setPost] = useState<PostPreview | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/preview?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setPost)
      .catch(() => setError(true))
  }, [slug])

  if (error) return (
    <div className="rounded-2xl px-4 py-3 my-3 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
      引用文章不存在或已删除
    </div>
  )

  if (!post) return (
    <div className="rounded-2xl px-4 py-3 my-3 animate-pulse" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', height: 80 }} />
  )

  return (
    <Link href={`/post/${post.slug}`}
      className="block rounded-2xl px-4 py-3 my-3 transition-colors hover:opacity-90"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', textDecoration: 'none' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {post.author.username[0]?.toUpperCase()}
        </div>
        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{(post.author as any).displayName || post.author.username}</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>· 站内文章</span>
      </div>
      <p className="text-sm font-bold mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>{post.title}</p>
      {post.excerpt && (
        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
      )}
    </Link>
  )
}

interface OGData {
  title: string
  description: string
  image: string
  hostname: string
  url: string
}

interface ExternalQuoteProps {
  url: string
}

export function ExternalQuoteCard({ url }: ExternalQuoteProps) {
  const [og, setOg] = useState<OGData | null>(null)
  const [loading, setLoading] = useState(true)

  let hostname = ''
  try { hostname = new URL(url).hostname } catch {}

  useEffect(() => {
    // 命中模块缓存，直接使用
    if (ogCache.has(url)) {
      setOg(ogCache.get(url))
      setLoading(false)
      return
    }
    // 去重：同 URL 已在请求中，复用同一个 Promise
    if (!ogPending.has(url)) {
      const p = fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .finally(() => ogPending.delete(url))
      ogPending.set(url, p)
    }
    ogPending.get(url)!.then(data => {
      ogCache.set(url, data)
      setOg(data)
      setLoading(false)
    })
  }, [url])

  if (loading) return (
    <div className="rounded-2xl px-4 py-3 my-3 animate-pulse" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', height: 72 }} />
  )

  const title = og?.title || hostname || url
  const desc = og?.description || ''
  const image = og?.image || ''

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="block rounded-2xl my-3 overflow-hidden transition-opacity hover:opacity-80"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', textDecoration: 'none' }}
    >
      <div className="flex">
        {image && (
          <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{og?.hostname || hostname}</span>
          </div>
          <p className="text-sm font-bold line-clamp-1 mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {desc && <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{desc}</p>}
        </div>
      </div>
    </a>
  )
}
