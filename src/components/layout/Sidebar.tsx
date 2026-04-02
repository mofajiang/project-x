'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { JWTPayload } from '@/lib/auth'
import type { SiteLogo } from '@/lib/config'
import { isImageSource } from '@/lib/config'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// X 风格 SVG 图标
const IconHome = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.75}>
    {filled
      ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      : <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>}
  </svg>
)
const IconArchive = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    {filled
      ? <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      : <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>}
  </svg>
)
const IconTag = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M7 7h.01M3 3h8l9 9a2 2 0 010 2.828l-5.172 5.172a2 2 0 01-2.828 0L3 11V3z"/>
  </svg>
)
const IconUser = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

const ICON_MAP: Record<string, React.ComponentType<{ filled?: boolean }>> = {
  home: IconHome,
  archive: IconArchive,
  tag: IconTag,
  user: IconUser,
}

export type NavItemDef = { label: string; href: string; icon: string }

interface Props {
  siteName: string
  siteLogo?: SiteLogo | null
  loginMode: string
  secretClicks: number
  loginPath?: string
  navItems?: NavItemDef[]
  session?: JWTPayload | null
  avatar?: string | null
  displayName?: string
  handle?: string
}

const DEFAULT_NAV: NavItemDef[] = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '归档', href: '/archive', icon: 'archive' },
  { label: '标签', href: '/tags', icon: 'tag' },
  { label: '关于', href: '/about', icon: 'user' },
]

export function Sidebar({ siteName, siteLogo, loginMode, secretClicks, loginPath = '/admin-login', navItems, session, avatar, displayName = '', handle = '' }: Props) {
  const items = (navItems && navItems.length > 0) ? navItems : DEFAULT_NAV
  const pathname = usePathname()
  const router = useRouter()
  const [clicks, setClicks] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const logout = async () => {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    router.refresh()
  }

  useEffect(() => {
    if (clicks > 0 && clicks >= secretClicks && (loginMode === 'secret-click' || loginMode === 'both')) {
      window.location.href = loginPath.startsWith('/') ? loginPath : `/${loginPath}`
    }
  }, [clicks, secretClicks, loginMode, loginPath])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogoClick = () => {
    if (loginMode === 'secret-click' || loginMode === 'both') {
      setClicks(c => c + 1)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setClicks(0), 3000)
    } else {
      router.push('/')
    }
  }

  const logoValue = (siteLogo?.value || '✕').trim() || '✕'
  const isLogoImage = siteLogo?.type === 'image' && isImageSource(logoValue)

  return (
    <aside className="w-[72px] xl:w-[240px] sticky top-0 h-screen flex flex-col px-2 xl:px-3 py-4">
      {/* Logo */}
      <button
        onClick={handleLogoClick}
        className={isLogoImage
          ? "w-10 h-10 px-1.5 rounded-full flex items-center justify-center mb-2 transition-colors select-none self-start overflow-hidden"
          : "min-w-[3rem] h-12 px-3 rounded-full flex items-center justify-start mb-2 transition-colors select-none self-start overflow-hidden"}
        style={{ color: 'var(--text-primary)' }}
        title={siteName}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {isLogoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoValue} alt={siteName} className="w-[20px] h-[20px] flex-none object-contain" />
        ) : (
          <span className={siteLogo?.type === 'text' ? 'text-[18px] font-black leading-none' : 'text-[22px] leading-none'}>
            {logoValue}
          </span>
        )}
      </button>

      {/* 导航 + 写文章按钮 */}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = ICON_MAP[item.icon] || IconHome
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-3 py-2.5 rounded-full transition-all duration-150 group xl:px-4 w-fit"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="flex-shrink-0">
                <Icon filled={active} />
              </span>
              <span className="hidden xl:inline text-[19px]" style={{ fontWeight: active ? 700 : 400 }}>{item.label}</span>
            </Link>
          )
        })}

        {/* 写文章按钮 — 仅登录后显示 */}
        {session && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-compose'))}
            className="mt-3 py-3 rounded-full text-center font-bold text-white text-[15px] transition-all duration-150 hover:opacity-90 active:scale-95 xl:w-[90%] w-12 h-12 flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <span className="hidden xl:inline">写文章</span>
            <svg className="xl:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </nav>

      {/* 底部用户卡片（X 风格） */}
      {session && (
        <div ref={menuRef} className="mt-auto relative">
          {/* 弹出菜单 */}
          {menuOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 w-[240px] rounded-2xl overflow-hidden shadow-xl z-50"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                后台控制台
              </Link>
              <div style={{ borderTop: '1px solid var(--border)' }} />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>切换主题</span>
                <ThemeToggle className="w-9 h-9" />
              </div>
              <div style={{ borderTop: '1px solid var(--border)' }} />
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold w-full text-left transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                退出登录 @{session.username}
              </button>
            </div>
          )}

          {/* 用户卡片触发按钮 */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-3 w-full px-2 py-2.5 rounded-full transition-colors xl:px-3"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* 头像 */}
            <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-base"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {avatar
                ? <img src={avatar} alt={session.username} className="w-full h-full object-cover" />
                : session.username[0]?.toUpperCase()}
            </div>
            {/* 用户名（宽屏显示） */}
            <div className="hidden xl:flex flex-col items-start min-w-0 flex-1">
              <span className="text-sm font-bold truncate w-full" style={{ color: 'var(--text-primary)' }}>{displayName || handle || session.username}</span>
              <span className="text-xs truncate w-full" style={{ color: 'var(--text-secondary)' }}>@{handle || session.username}</span>
            </div>
            {/* 三个点 */}
            <svg className="hidden xl:block flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
        </div>
      )}
    </aside>
  )
}
