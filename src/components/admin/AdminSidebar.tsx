'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AdminUpdateChecker } from './AdminUpdateChecker'

type ThemeMode = 'dark' | 'light'
const THEME_CYCLE: ThemeMode[] = ['dark', 'light']
const THEME_LABELS: Record<ThemeMode, string> = { dark: '🌙 暗黑', light: '☀️ 浅色' }

function AdminThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('adminThemeMode') || localStorage.getItem('theme') || 'dark') as ThemeMode
    const valid = (THEME_CYCLE as string[]).includes(saved) ? saved as ThemeMode : 'dark'
    setTheme(valid)
    document.documentElement.classList.remove('dark', 'light', 'sepia')
    document.documentElement.classList.add(valid)
  }, [])

  const toggle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    localStorage.setItem('adminThemeMode', next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.remove('dark', 'light', 'sepia')
    document.documentElement.classList.add(next)
    // sepia 已移除，如已保存 sepia 则重置为 dark
  }

  return (
    <button
      onClick={toggle}
      title={`当前：${THEME_LABELS[theme]}，点击切换`}
      className={compact
        ? 'flex items-center gap-1 px-3 py-2 rounded-full text-xs transition-colors shrink-0'
        : 'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors'}
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{THEME_LABELS[theme].split(' ')[0]}</span>
      <span className={compact ? 'text-[11px]' : 'flex-1 text-left text-xs'}>{THEME_LABELS[theme].split(' ')[1]}</span>
      {!compact && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>切换</span>}
    </button>
  )
}



const navItems = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '文章管理', href: '/admin/posts', icon: '📝' },
  { label: '评论管理', href: '/admin/comments', icon: '💬', badge: true },
  { label: '标签管理', href: '/admin/tags', icon: '🏷' },
  { label: '安全设置', href: '/admin/security', icon: '🔒' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️' },
  { label: '导航与组件', href: '/admin/navigation', icon: '🧭' },
]

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchPending = () => fetch('/api/admin/comments/pending')
      .then(r => r.json())
      .then(d => setPendingCount(d.count || 0))
      .catch(() => {})
    fetchPending()
    const timer = setInterval(fetchPending, 60_000)

    return () => clearInterval(timer)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    router.push('/admin/login')
  }

  return (
    <>
      {/* 桌面端左侧栏 */}
      <aside className="hidden md:flex w-56 min-h-screen flex-col py-6 px-3" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        <div className="px-3 mb-6">
          <p className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>⚙ 后台管理</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>@{username}</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors"
              style={{
                background: pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)) ? 'var(--bg-hover)' : 'transparent',
                color: pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)) ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname.startsWith(item.href) ? '600' : '400',
              }}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--red,#F4212E)', color: '#fff' }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>


        <div className="px-3 mt-4 flex flex-col gap-2">
          <AdminUpdateChecker />
          <AdminThemeToggle />
          <a href="/" target="_blank" className="text-sm py-2 px-3 rounded-xl text-center transition-colors hover:bg-x-bg-hover" style={{ color: 'var(--text-secondary)' }}>查看博客 ↗</a>
          <button onClick={logout} className="text-sm py-2 px-3 rounded-xl text-center transition-colors w-full" style={{ color: 'var(--red)' }}>退出登录</button>
        </div>
      </aside>

      {/* 移动端导航已移至 MobileNav 组件 */}
    </>
  )
}