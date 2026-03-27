'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItemDef } from './Sidebar'

const IconHome = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.75}>
    {filled
      ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      : <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>}
  </svg>
)
const IconArchive = ({ filled }: { filled?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
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

const DEFAULT_NAV: NavItemDef[] = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '归档', href: '/archive', icon: 'archive' },
  { label: '标签', href: '/tags', icon: 'tag' },
  { label: '关于', href: '/about', icon: 'user' },
]

// 搜索图标
const IconSearch = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
// 后台图标
const IconAdmin = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
// 写文章图标
const IconWrite = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

type TabItem = { href: string; icon: React.ReactNode; label: string; exact: boolean; isSearch?: boolean; accent?: boolean }

interface Props {
  navItems?: NavItemDef[]
  session?: { username: string } | null
}

export function MobileTabBar({ navItems, session }: Props) {
  const pathname = usePathname()

  // 已登录：搜索、首页、后台、写文章
  // 未登录：搜索、首页、归档、标签
  const loggedInTabs: TabItem[] = [
    { href: '/search', icon: <IconSearch />, label: '搜索', exact: false, isSearch: true },
    { href: '/', icon: <IconHome filled={pathname === '/'} />, label: '首页', exact: true },
    { href: '/admin', icon: <IconAdmin />, label: '后台', exact: false },
    { href: '#compose', icon: <IconWrite />, label: '写文章', exact: false, isSearch: false, accent: true },
  ]

  const guestTabs: TabItem[] = [
    { href: '/search', icon: <IconSearch />, label: '搜索', exact: false, isSearch: true },
    { href: '/', icon: <IconHome filled={pathname === '/'} />, label: '首页', exact: true },
    { href: '/archive', icon: <IconArchive filled={pathname.startsWith('/archive')} />, label: '归档', exact: false },
    { href: '/tags', icon: <IconTag filled={pathname.startsWith('/tags')} />, label: '标签', exact: false },
  ]

  const tabs = session ? loggedInTabs : guestTabs

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14"
      style={{
        background: 'var(--bg)',
        borderTop: '0.5px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : (!tab.isSearch && !tab.accent && pathname.startsWith(tab.href))
        if (tab.href === '#compose') {
          return (
            <button
              key="compose"
              onClick={() => window.dispatchEvent(new Event('open-compose'))}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
              style={{ color: 'var(--accent)' }}
            >
              {tab.icon}
            </button>
          )
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
            style={{ color: tab.accent ? 'var(--accent)' : active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {tab.icon}
          </Link>
        )
      })}
    </nav>
  )
}
