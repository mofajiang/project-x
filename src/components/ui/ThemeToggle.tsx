'use client'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'sepia'

const THEME_CYCLE: Theme[] = ['dark', 'light', 'sepia']

const THEME_TITLES: Record<Theme, string> = {
  dark: '切换为浅色模式',
  light: '切换为护眼模式',
  sepia: '切换为深色模式',
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove('light', 'sepia')
  if (theme !== 'dark') document.documentElement.classList.add(theme)
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const initial: Theme = saved && THEME_CYCLE.includes(saved) ? saved : 'dark'
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggle = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      title={THEME_TITLES[theme]}
      className={`flex items-center justify-center rounded-full transition-colors ${className}`}
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {theme === 'dark' && (
        // 太阳图标（当前深色，点击切换到浅色）
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
      {theme === 'light' && (
        // 书本图标（当前浅色，点击切换到护眼）
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
        </svg>
      )}
      {theme === 'sepia' && (
        // 月亮图标（当前护眼，点击切换到深色）
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  )
}
