'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

type PostResult = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
}

const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

const IconBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PostResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch {}
      setLoading(false)
      setSearched(true)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* 搜索栏 */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-3 py-3"
        style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)' }}
      >
        <button
          onClick={() => router.back()}
          className="flex-shrink-0 p-1 rounded-full"
          style={{ color: 'var(--text-secondary)' }}
        >
          <IconBack />
        </button>
        <div
          className="flex items-center flex-1 gap-2 px-3 py-2 rounded-full"
          style={{ background: 'var(--hover)', color: 'var(--text-secondary)' }}
        >
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索文章..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text-secondary)' }}>
              <IconX />
            </button>
          )}
        </div>
      </div>

      {/* 结果列表 */}
      <div className="px-4 py-3">
        {loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>搜索中...</p>
        )}
        {!loading && searched && results.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>没有找到「{query}」相关文章</p>
        )}
        {!loading && !searched && !query && (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-secondary)' }}>输入关键词开始搜索</p>
        )}
        {!loading && results.length > 0 && (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {results.map(post => (
              <Link
                key={post.id}
                href={`/post/${post.slug}`}
                className="py-3 flex flex-col gap-1 hover:bg-[var(--hover)] -mx-1 px-1 rounded"
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{post.title}</span>
                {post.excerpt && (
                  <span className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</span>
                )}
                {post.publishedAt && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(new Date(post.publishedAt))}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
