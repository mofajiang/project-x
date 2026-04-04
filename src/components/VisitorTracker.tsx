'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type GeoMode = 'offline' | 'ip9' | 'ipwho' | 'ipapi' | 'ipinfo' | 'ip-api' | 'geolocation-db' | 'custom' | string

type VisitorGeo = {
  country?: string
  countryCode?: string
  region?: string
  city?: string
  lat?: number | null
  lon?: number | null
}

type Props = {
  visitorGeoMode?: GeoMode
  visitorGeoEndpoint?: string
  visitorGeoKey?: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const headers = new Headers({ Accept: 'application/json' })
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }
    const { headers: _ignoredHeaders, ...restInit } = init || {}
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      mode: 'cors',
      credentials: 'omit',
      headers,
      ...restInit,
    })
    if (!response.ok) {
      console.debug('[VisitorTracker] fetch failed:', url, response.status, response.statusText)
      return null
    }
    const data = await response.json() as T
    return data
  } catch (err) {
    console.debug('[VisitorTracker] fetch error:', url, err instanceof Error ? err.message : String(err))
    return null
  }
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
