'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useIMEInput } from '@/hooks/useIMEInput'

export function SearchBox() {
  const router = useRouter()
  const [focused, setFocused] = useState(false)
  const [value, setValue] = useState('')
  const imeInput = useIMEInput(value, setValue)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`)
  }

  return (
    <form onSubmit={handleSearch} className="relative mb-4">
      {/* 搜索图标 */}
      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
        style={{ color: focused ? 'var(--accent)' : 'var(--text-secondary)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </span>
      <input
        type="text"
        {...imeInput}
        placeholder="搜索"
        className="w-full pl-11 pr-4 py-3 rounded-full text-[15px] outline-none transition-all"
        style={{
          background: focused ? 'transparent' : 'var(--bg-hover)',
          color: 'var(--text-primary)',
          border: focused ? '1px solid var(--accent)' : '1px solid transparent',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </form>
  )
}
