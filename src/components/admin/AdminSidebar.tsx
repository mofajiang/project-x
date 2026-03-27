'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const navItems = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '文章管理', href: '/admin/posts', icon: '📝' },
  { label: '评论管理', href: '/admin/comments', icon: '💬', badge: true },
  { label: '标签管理', href: '/admin/tags', icon: '🏷' },
  { label: '安全设置', href: '/admin/security', icon: '🔒' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️' },
  { label: '邮件通知', href: '/admin/smtp', icon: '📧' },
]

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetch_ = () => fetch('/api/admin/comments/pending').then(r => r.json()).then(d => setPendingCount(d.count || 0)).catch(() => {})
    fetch_()
    const timer = setInterval(fetch_, 60_000)
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
          <a href="/" target="_blank" className="text-sm py-2 px-3 rounded-xl text-center transition-colors hover:bg-x-bg-hover" style={{ color: 'var(--text-secondary)' }}>查看博客 ↗</a>
          <button onClick={logout} className="text-sm py-2 px-3 rounded-xl text-center transition-colors w-full" style={{ color: 'var(--red)' }}>退出登录</button>
        </div>
      </aside>

      {/* 移动端顶部 header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>⚙ 后台管理</p>
        <div className="flex items-center gap-2">
          <ThemeToggle className="w-8 h-8" />
          <a href="/" target="_blank" className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>前台 ↗</a>
          <button onClick={logout} className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--red)', border: '1px solid var(--border)' }}>退出</button>
        </div>
      </header>

      {/* 移动端底部 tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center overflow-x-auto"
        style={{ background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[60px] py-2 text-[10px] relative"
              style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: active ? 700 : 400 }}>
              <span className="text-lg leading-none relative inline-block">
                {item.icon}
                {item.badge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full leading-tight" style={{ background: 'var(--red,#F4212E)', color: '#fff', minWidth: '14px', textAlign: 'center' }}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </span>
              <span className="truncate w-full text-center px-1">{item.label.replace('管理','').replace('设置','').replace('通知','')}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}