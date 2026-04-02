'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    const query = window.location.search.replace(/^\?/, '')
    const path = query ? `${pathname}?${query}` : pathname
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || '',
      userAgent: navigator.userAgent,
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track-visit', new Blob([payload], { type: 'application/json' }))
      return
    }

    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
