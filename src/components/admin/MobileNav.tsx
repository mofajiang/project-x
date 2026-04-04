'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AdminUpdateChecker } from './AdminUpdateChecker'

type ThemeMode = 'dark' | 'light'
const THEME_CYCLE: ThemeMode[] = ['dark', 'light']
const THEME_LABELS: Record<ThemeMode, string> = { dark: '🌙 暗黑', light: '☀️ 浅色' }

const navItems = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '文章管理', href: '/admin/posts', icon: '📝' },
  { label: '评论管理', href: '/admin/comments', icon: '💬' },
  { label: '标签管理', href: '/admin/tags', icon: '🏷' },
  { label: '安全设置', href: '/admin/security', icon: '🔒' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️' },
  { label: '导航与组件', href: '/admin/navigation', icon: '🧭' },
]

export function MobileNav({ username, pendingCount }: { username: string; pendingCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('adminThemeMode') || localStorage.getItem('theme') || 'dark') as ThemeMode
    const valid = (THEME_CYCLE as string[]).includes(saved) ? (saved as ThemeMode) : 'dark'
    setTheme(valid)
  }, [])

  const toggleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    localStorage.setItem('adminThemeMode', next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(next)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    router.push('/admin/login')
  }

  return (
    <>
      {/* 顶部迷你导航 - 仅汉堡菜单和标题 */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="text-xl p-2"
          title="打开菜单"
        >
          ☰
        </button>
        <h1 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
          ⚙ 后台
        </h1>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-2 py-1 rounded"
          style={{ color: 'var(--accent)' }}
          title="查看前台"
        >
          👁️
        </a>
      </header>

      {/* 抽屉菜单背景层 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 抽屉菜单 */}
      <nav
        className={`md:hidden fixed left-0 w-72 z-40 transform transition-transform duration-300 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', top: '3.5rem', bottom: 0 }}
      >
        {/* 菜单顶部 - 用户信息 */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            ⚙ 后台管理
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            @{username}
          </p>
        </div>

        {/* 导航菜单 */}
        <div className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? '600' : '400',
                }}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {item.label === '评论管理' && pendingCount > 0 && (
                  <span
                    className="ml-auto text-xs font-bold px-2 py-1 rounded-full text-white"
                    style={{ background: 'var(--red,#F4212E)' }}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* 菜单底部 - 设置 */}
        <div className="p-4 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2">
            <AdminUpdateChecker compact={true} />
          </div>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-2"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <span className="text-base">{THEME_LABELS[theme].split(' ')[0]}</span>
            <span className="flex-1 text-left">{THEME_LABELS[theme].split(' ')[1]}</span>
          </button>
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-lg text-sm text-white font-bold"
            style={{ background: 'var(--red,#F4212E)' }}
          >
            退出登录
          </button>
        </div>
      </nav>
    </>
  )
}
