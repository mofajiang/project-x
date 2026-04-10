'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useIMEInput } from '@/hooks/useIMEInput'

type SearchResult = {
  id: string
  title: string
  slug: string
  excerpt: string
  publishedAt: string | null
}

export function SearchBox() {
  const [focused, setFocused] = useState(false)
  const [value, setValue] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imeInput = useIMEInput(value, setValue)

  useEffect(() => {
    const q = value.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults(await res.json())
      } catch {}
      setLoading(false)
    }, 350)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value])

  // 点击外部关闭结果
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const showDropdown = focused && value.trim().length > 0

  return (
    <div ref={containerRef} className="relative mb-4">
      {/* 搜索框 */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-3 transition-all"
        style={{
          background: focused ? 'transparent' : 'var(--bg-hover)',
          border: focused ? '1px solid var(--accent)' : '1px solid transparent',
        }}
      >
        <span
          className="pointer-events-none flex-shrink-0 transition-colors"
          style={{ color: focused ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {loading ? (
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </span>
        <input
          type="text"
          {...imeInput}
          placeholder="搜索"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: 'var(--text-primary)' }}
          onFocus={() => setFocused(true)}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              setResults([])
            }}
            className="flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 实时搜索结果下拉 */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-2xl py-1 shadow-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {results.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              没有找到「{value.trim()}」相关文章
            </p>
          )}
          {results.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.slug}`}
              onClick={() => {
                setFocused(false)
                setValue('')
                setResults([])
              }}
              className="flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-white/5"
            >
              <span className="line-clamp-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {post.title}
              </span>
              {post.excerpt && (
                <span className="line-clamp-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {post.excerpt}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
