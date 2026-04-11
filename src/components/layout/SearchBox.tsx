'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIMEInput } from '@/hooks/useIMEInput'
import { getPostPath } from '@/lib/post-link'

type SearchResult = {
  id: string
  publicId: number | null
  title: string
  slug: string
  excerpt: string
  publishedAt: string | null
  author: { username: string }
}

const RECENTS_KEY = 'searchbox-recents'
const MAX_RECENTS = 5

function getRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
  } catch {
    return []
  }
}
function addRecent(q: string) {
  const arr = [q, ...getRecents().filter((r) => r !== q)].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(arr))
}
function removeRecent(q: string) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(getRecents().filter((r) => r !== q)))
}

export function SearchBox() {
  const router = useRouter()
  const [focused, setFocused] = useState(false)
  const [value, setValue] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recents, setRecents] = useState<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imeInput = useIMEInput(value, setValue)

  // 客户端加载 recent searches
  useEffect(() => {
    setRecents(getRecents())
  }, [])

  // 实时搜索
  useEffect(() => {
    const q = value.trim()
    setActiveIndex(-1)
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

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navigateTo = useCallback(
    (q: string) => {
      addRecent(q)
      setRecents(getRecents())
      setFocused(false)
      setValue('')
      setResults([])
      setActiveIndex(-1)
      router.push(`/search?q=${encodeURIComponent(q)}`)
    },
    [router]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    const items = value.trim() ? results : []
    if (e.key === 'Escape') {
      setFocused(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && items[activeIndex]) {
        addRecent(value.trim())
        setRecents(getRecents())
        setFocused(false)
        setValue('')
        setResults([])
        setActiveIndex(-1)
        router.push(getPostPath(items[activeIndex]))
      } else if (value.trim()) {
        navigateTo(value.trim())
      }
    }
  }

  const showDropdown = focused && (value.trim().length > 0 || recents.length > 0)

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
          ref={inputRef}
          type="text"
          {...imeInput}
          placeholder="搜索"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: 'var(--text-primary)' }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              setResults([])
              inputRef.current?.focus()
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

      {/* 下拉面板 */}
      {showDropdown && (
        <div
          className="no-scrollbar absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-2xl py-1 shadow-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {/* 空查询 → 展示最近搜索 */}
          {!value.trim() && recents.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                最近搜索
              </p>
              {recents.map((r) => (
                <div
                  key={r}
                  className="group flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-white/5"
                >
                  <button
                    className="min-w-0 flex-1 text-left text-sm"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => navigateTo(r)}
                  >
                    <svg
                      className="mr-2 inline-block opacity-50"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {r}
                  </button>
                  <button
                    onClick={() => {
                      removeRecent(r)
                      setRecents(getRecents())
                    }}
                    className="shrink-0 opacity-0 transition-opacity hover:opacity-70 group-hover:opacity-100"
                    style={{ color: 'var(--text-secondary)' }}
                    title="删除"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* 有查询 → 展示结果 */}
          {value.trim() && (
            <>
              {results.length === 0 && !loading && (
                <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  没有找到「{value.trim()}」相关文章
                </p>
              )}
              {results.map((post, idx) => (
                <Link
                  key={post.id}
                  href={getPostPath(post)}
                  onClick={() => {
                    addRecent(value.trim())
                    setRecents(getRecents())
                    setFocused(false)
                    setValue('')
                    setResults([])
                  }}
                  className={`flex flex-col gap-0.5 px-4 py-2.5 transition-colors ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
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
              {/* 查看全部结果 */}
              <button
                onClick={() => navigateTo(value.trim())}
                className="flex w-full items-center gap-2 border-t px-4 py-3 text-[13px] font-semibold transition-colors hover:bg-white/5"
                style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                查看「{value.trim()}」的所有结果
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
