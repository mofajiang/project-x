'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLogout } from '@/hooks/useLogout'
import { AdminUpdateChecker } from './AdminUpdateChecker'
// AdminUpdateChecker has been moved to the settings page
import { ADMIN_NAV_ITEMS, ADMIN_NAV_GROUPS } from './navItems'

type ThemeMode = 'dark' | 'light'
const THEME_CYCLE: ThemeMode[] = ['dark', 'light']
const THEME_LABELS: Record<ThemeMode, string> = { dark: '🌙 暗黑', light: '☀️ 浅色' }

function AdminThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('adminThemeMode') || localStorage.getItem('theme') || 'dark') as ThemeMode
    const valid = (THEME_CYCLE as string[]).includes(saved) ? (saved as ThemeMode) : 'dark'
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
      className={
        compact
          ? 'flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs transition-colors'
          : 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors'
      }
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{THEME_LABELS[theme].split(' ')[0]}</span>
      <span className={compact ? 'text-[11px]' : 'flex-1 text-left text-xs'}>{THEME_LABELS[theme].split(' ')[1]}</span>
      {!compact && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px]"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
        >
          切换
        </span>
      )}
    </button>
  )
}

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchPending = () =>
      fetch('/api/admin/comments/pending')
        .then((r) => r.json())
        .then((d) => setPendingCount(d.count || 0))
        .catch(() => {})
    fetchPending()
    const timer = setInterval(fetchPending, 60_000)

    return () => clearInterval(timer)
  }, [])

  const logout = useLogout('/admin/login')

  return (
    <>
      {/* 桌面端左侧栏：图标模式，hover 覆盖展开 */}
      <aside
        className="relative hidden h-screen shrink-0 lg:flex"
        style={{ width: 56, zIndex: 40 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div
          className="absolute inset-y-0 left-0 flex flex-col overflow-hidden py-4"
          style={{
            width: expanded ? 220 : 56,
            transition: expanded
              ? 'width 0.22s ease, box-shadow 0.2s ease'
              : 'width 0.2s ease 0.06s, box-shadow 0.15s ease',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            boxShadow: expanded ? '6px 0 24px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          {/* Logo */}
          <div className="mb-4 flex items-center gap-3 overflow-hidden whitespace-nowrap px-3" style={{ height: 36 }}>
            <span className="shrink-0 text-lg" style={{ width: 22, textAlign: 'center' }}>
              ⚙
            </span>
            <div style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
              <p className="whitespace-nowrap text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                后台管理
              </p>
              <p className="whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                @{username}
              </p>
            </div>
          </div>

          {/* 分组导航 */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
            {ADMIN_NAV_GROUPS.map((group, gi) => {
              const items = ADMIN_NAV_ITEMS.filter((item) => item.group === group.key)
              return (
                <div key={group.key}>
                  {gi > 0 && <div className="mx-2 my-1.5" style={{ borderTop: '1px solid var(--border)' }} />}
                  <p
                    className="whitespace-nowrap px-3 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: 'var(--text-secondary)',
                      opacity: expanded ? 0.55 : 0,
                      maxHeight: expanded ? '20px' : '0',
                      paddingTop: expanded ? '2px' : '0',
                      paddingBottom: expanded ? '2px' : '0',
                      overflow: 'hidden',
                      transition: 'opacity 0.15s, max-height 0.15s, padding 0.1s',
                    }}
                  >
                    {group.label}
                  </p>
                  {items.map((item) => {
                    const active =
                      item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        title={item.label}
                        className="relative flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors"
                        style={{
                          background: active ? 'var(--bg-hover)' : 'transparent',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: active ? '600' : '400',
                        }}
                      >
                        <span className="shrink-0 leading-none" style={{ width: 22, textAlign: 'center' }}>
                          {item.icon}
                        </span>
                        <span
                          className="flex-1"
                          style={{
                            opacity: expanded ? 1 : 0,
                            transition: expanded ? 'opacity 0.13s ease 0.12s' : 'opacity 0.08s ease',
                          }}
                        >
                          {item.label}
                        </span>
                        {item.badge && pendingCount > 0 && expanded && (
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none"
                            style={{
                              background: 'var(--red,#F4212E)',
                              color: '#fff',
                              opacity: expanded ? 1 : 0,
                              transition: expanded ? 'opacity 0.13s ease 0.12s' : 'opacity 0.08s ease',
                            }}
                          >
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                        {item.badge && pendingCount > 0 && !expanded && (
                          <span
                            className="absolute right-1 top-1 h-2 w-2 rounded-full"
                            style={{ background: 'var(--red,#F4212E)' }}
                          />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {/* 底部工具 - 折叠时整体隐藏，hover 展开后显示 */}
          <div
            className="mt-2 overflow-hidden px-2"
            style={{
              maxHeight: expanded ? '160px' : '0',
              opacity: expanded ? 1 : 0,
              transition: expanded
                ? 'max-height 0.2s ease, opacity 0.13s ease 0.1s'
                : 'max-height 0.2s ease 0.05s, opacity 0.08s ease',
            }}
          >
            <div className="flex flex-col gap-1">
              <AdminUpdateChecker compact />
              <AdminThemeToggle />
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-3 py-1.5 text-center text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                查看博客 ↗
              </a>
              <button
                onClick={logout}
                className="w-full rounded-xl px-3 py-1.5 text-center text-xs"
                style={{ color: 'var(--red)' }}
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 移动端导航已移至 MobileNav 组件 */}
    </>
  )
}
