'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type GeoMode = 'offline' | 'ip9' | 'uapis' | 'custom' | string

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

async function fetchPublicIp() {
  try {
    const response = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!response.ok) return ''
    const data = await response.json() as { ip?: string }
    return data.ip || ''
  } catch {
    return ''
  }
}

async function resolveVisitorGeo(mode: GeoMode, endpoint: string, key: string) {
  if (!mode || mode === 'offline') return null

  if (mode === 'ip9') {
    // Let the backend resolve the client IP from request headers and query IP9.
    const url = '/api/geo/ip9'
    const data = await fetchJson<{
      ret?: number
      data?: {
        country?: string
        country_code?: string
        prov?: string
        city?: string
        area?: string
        lat?: string
        lng?: string
      }
    }>(url)
    // ip9 may return different 'ret' codes across versions; accept any response that contains `data`
    if (data?.data) {
      const d = data.data
      const lat = typeof d.lat === 'string' ? Number(d.lat) : null
      const lon = typeof d.lng === 'string' ? Number(d.lng) : null
      const region = [d.prov, d.city, d.area].filter(Boolean).join(' ')
      const result = {
        country: (d.country || '').trim(),
        countryCode: (d.country_code || '').trim().toUpperCase(),
        region,
        city: (d.city || '').trim(),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      }
      console.debug('[VisitorTracker] ip9 resolved:', result)
      return result
    }
    console.debug('[VisitorTracker] ip9 response missing data field:', data)
    return null
  }

  if (mode === 'uapis') {
    if (!key.trim()) {
      console.debug('[VisitorTracker] uapis key missing')
      return null
    }
    const data = await fetchJson<{
      ip?: string
      region?: string
      isp?: string
      llc?: string
      asn?: string
      latitude?: number
      longitude?: number
      beginip?: string
      endip?: string
      district?: string
      time_zone?: string
    }>('https://uapis.cn/api/v1/network/myip?source=commercial', {
      headers: {
        Authorization: `Bearer ${key.trim()}`,
      },
    })
    if (!data) return null
    const regionParts = (data.region || '').trim().split(/\s+/).filter(Boolean)
    const country = regionParts[0] || ''
    const province = regionParts[1] || ''
    const city = regionParts[2] || ''
    const result = {
      country,
      countryCode: '',
      region: [province, city].filter(Boolean).join(' '),
      city: data.district || city,
      lat: typeof data.latitude === 'number' ? data.latitude : null,
      lon: typeof data.longitude === 'number' ? data.longitude : null,
    }
    console.debug('[VisitorTracker] uapis resolved:', result, data)
    return result
  }

  if (mode === 'custom' && endpoint.trim()) {
    const cleanEndpoint = endpoint.trim()
    if (cleanEndpoint.includes('{ip}')) {
      const ip = await fetchPublicIp()
      if (!ip) return null
      const text = await fetchJson<Record<string, unknown>>(cleanEndpoint.replaceAll('{ip}', encodeURIComponent(ip)))
      return text ? normalizeGeoRecord(text) : null
    }
    const text = await fetchJson<Record<string, unknown>>(cleanEndpoint)
    return text ? normalizeGeoRecord(text) : null
  }

  return null
}

function normalizeGeoRecord(record: Record<string, unknown>): VisitorGeo | null {
  const country = String(record.country || record.country_name || record.countryCode || record.country_code || '').trim()
  const region = String(record.region || record.region_name || record.regionName || record.prov || '').trim()
  const city = String(record.city || record.city_name || '').trim()
  const latValue = record.latitude ?? record.lat
  const lonValue = record.longitude ?? record.lon ?? record.lng
  const lat = typeof latValue === 'number' ? latValue : typeof latValue === 'string' ? Number(latValue) : null
  const lon = typeof lonValue === 'number' ? lonValue : typeof lonValue === 'string' ? Number(lonValue) : null
  const countryCode = String(record.country_code || record.countryCode || '').trim().toUpperCase()

  const normalized: VisitorGeo = {
    country: country,
    countryCode,
    region,
    city,
    lat: Number.isFinite(lat as number) ? lat : null,
    lon: Number.isFinite(lon as number) ? lon : null,
  }

  if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
    return normalized
  }
  return null
}

export function VisitorTracker({ visitorGeoMode = 'offline', visitorGeoEndpoint = '', visitorGeoKey = '' }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    let cancelled = false

    const send = async () => {
      const query = window.location.search.replace(/^\?/, '')
      const path = query ? `${pathname}?${query}` : pathname
      const geo = await resolveVisitorGeo(visitorGeoMode, visitorGeoEndpoint, visitorGeoKey)
      if (cancelled) return

      const payload = JSON.stringify({
        path,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent,
        geo,
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
  }, [pathname, visitorGeoEndpoint, visitorGeoMode])

  return null
}
