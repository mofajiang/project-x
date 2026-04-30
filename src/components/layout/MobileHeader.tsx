'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import type { JWTPayload } from '@/lib/auth'
import type { RightPanelWidget, SiteLogo } from '@/lib/config'
import { isImageSource } from '@/lib/config'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { MobileDrawer } from './MobileDrawer'
import type { NavItemDef } from './Sidebar'

type TopTag = { id: string; name: string; slug: string; posts: number }
type TopPost = {
  id: string
  title: string
  slug: string
  views: number
  publicId?: number | null
  author?: { username: string }
}

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
  approvedFriendLinks?: {
    id: string
    name: string
    url: string
    description?: string | null
    favicon?: string | null
  }[]
}

export function MobileHeader({
  siteName,
  session,
  avatar,
  displayName,
  handle,
  loginMode,
  secretClicks = 5,
  loginPath = '/admin-login',
  navItems,
  siteDesc = '',
  social = { x: '', github: '', email: '' },
  widgets = [],
  copyright = '',
  topTags = [],
  hotPosts = [],
  siteLogo = null,
  approvedFriendLinks = [],
}: Props) {
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
      setClicks((c) => c + 1)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setClicks(0), 3000)
    } else {
      router.push('/')
    }
  }

  const logoValue = (siteLogo?.value || siteName || 'X').trim() || 'X'
  const isLogoImage = siteLogo?.type === 'image' && isImageSource(logoValue)

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
        className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 backdrop-blur-md md:hidden"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition-opacity active:opacity-70"
          style={{ background: 'transparent', color: 'var(--text-secondary)' }}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开菜单"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex-1" />

        <ThemeToggle className="h-9 w-9" />
      </header>
    </>
  )
}
