'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type GeoMode = 'offline' | 'ip9' | 'ipwho' | 'ipapi' | 'ipinfo' | 'ip-api' | 'geolocation-db' | 'custom' | string

type Props = {
  visitorGeoMode?: GeoMode
  visitorGeoEndpoint?: string
  visitorGeoKey?: string
}

export function VisitorTracker({ visitorGeoMode = 'offline', visitorGeoEndpoint = '', visitorGeoKey = '' }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    let cancelled = false

    const send = async () => {
      const query = window.location.search.replace(/^\?/, '')
      const path = query ? `${pathname}?${query}` : pathname

      const payload = JSON.stringify({
        path,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent,
        geo: null,
        geoMode: visitorGeoMode,
        geoEndpoint: visitorGeoEndpoint,
        geoKey: visitorGeoKey,
      })

      console.debug('[VisitorTracker] sending payload:', payload)

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
    }

    send().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [pathname, visitorGeoEndpoint, visitorGeoKey, visitorGeoMode])

  return null
}
