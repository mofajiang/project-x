'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { getPostPath } from '@/lib/post-link'

type PostResult = {
  id: string
  publicId: number | null
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  author: { username: string }
}

const IconSearch = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const IconBack = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
  >
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
)

const IconX = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
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
        className="sticky top-0 z-10 flex items-center gap-3 px-3 py-3 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '0.5px solid var(--border)' }}
      >
        <button
          onClick={() => router.back()}
          className="flex-shrink-0 rounded-full p-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <IconBack />
        </button>
        <div
          className="flex flex-1 items-center gap-2 rounded-full px-3 py-2"
          style={{ background: 'var(--hover)', color: 'var(--text-secondary)' }}
        >
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章..."
            className="flex-1 bg-transparent text-sm outline-none"
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
          <div className="flex flex-col items-center gap-3 py-10" style={{ color: 'var(--text-secondary)' }}>
            <svg
              className="animate-spin"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
            <span className="text-sm">搜索中...</span>
          </div>
        )}
        {!loading && searched && results.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            没有找到「{query}」相关文章
          </p>
        )}
        {!loading && !searched && !query && (
          <p className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            输入关键词开始搜索
          </p>
        )}
        {!loading && results.length > 0 && (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {results.map((post) => (
              <Link
                key={post.id}
                href={getPostPath(post)}
                className="-mx-1 flex flex-col gap-1.5 rounded-lg px-1 py-3.5 transition-opacity active:opacity-70"
              >
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {post.title}
                </span>
                {post.excerpt && (
                  <span className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {post.excerpt}
                  </span>
                )}
                {post.publishedAt && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(new Date(post.publishedAt))}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
