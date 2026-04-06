'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import type { JWTPayload } from '@/lib/auth'
import type { RightPanelWidget, SiteLogo } from '@/lib/config'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { MobileDrawer } from './MobileDrawer'
import type { NavItemDef } from './Sidebar'

type TopTag = { id: string; name: string; slug: string; posts: number }
type TopPost = { id: string; title: string; slug: string; views: number }

interface Props {
  siteName: string
  session?: JWTPayload | null
  avatar?: string | null
  displayName?: string
  handle?: string
  loginMode?: string
  secretClicks?: number
  loginPath?: string
  navItems?: NavItemDef[]
  siteDesc?: string
  social?: { x: string; github: string; email: string }
  widgets?: RightPanelWidget[]
  copyright?: string
  topTags?: TopTag[]
  hotPosts?: TopPost[]
  siteLogo?: SiteLogo | null
  approvedFriendLinks?: { id: string; name: string; url: string; description?: string | null; favicon?: string | null }[]
}

export function MobileHeader({ siteName, session, avatar, displayName, handle, loginMode, secretClicks = 5, loginPath = '/admin-login', navItems, siteDesc = '', social = { x: '', github: '', email: '' }, widgets = [], copyright = '', topTags = [], hotPosts = [], siteLogo = null, approvedFriendLinks = [] }: Props) {
  const router = useRouter()
  const [clicks, setClicks] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (clicks > 0 && clicks >= secretClicks && (loginMode === 'secret-click' || loginMode === 'both')) {
      window.location.href = loginPath.startsWith('/') ? loginPath : `/${loginPath}`
    }
  }, [clicks, secretClicks, loginMode, loginPath])

  const handleLogoClick = () => {
    if (loginMode === 'secret-click' || loginMode === 'both') {
      setClicks(c => c + 1)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setClicks(0), 3000)
    } else {
      router.push('/')
    }
  }

  return (
    <>
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLogoClick={handleLogoClick}
        siteLogo={siteLogo}
        navItems={navItems}
        session={session}
        avatar={avatar}
        displayName={displayName}
        handle={handle}
        siteDesc={siteDesc}
        social={social}
        widgets={widgets}
        copyright={copyright}
        topTags={topTags}
        hotPosts={hotPosts}
        approvedFriendLinks={approvedFriendLinks}
      />
      <header
        className="md:hidden flex items-center justify-between px-4 h-14 sticky top-0 z-40"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        {/* 左侧：头像（点击打开抽屉） */}
        <button
          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 transition-opacity active:opacity-70"
          style={{ background: 'transparent', color: 'var(--text-secondary)' }}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开菜单"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

      {/* 右侧：主题切换 */}
      <ThemeToggle className="w-8 h-8" />
    </header>
    </>
  )
}
