'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > 600)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 切换页面时隐藏
  useEffect(() => { setVisible(false) }, [pathname])

  const handleClick = () => {
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      router.push('/')
    }
  }

  if (!visible) return null

  return (
    <button
      onClick={handleClick}
      aria-label="回到顶部"
      className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        // 桌面端：居中内容区左侧；手机端：居中
        bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '44px',
        height: '44px',
        background: 'var(--accent)',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(29,155,240,0.4)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    </button>
  )
}
