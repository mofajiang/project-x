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

async function resolveVisitorGeo(mode: GeoMode) {
  if (!mode || mode === 'offline') return null

  const providerUrlMap: Record<string, string> = {
    ip9: '/api/geo/ip9',
    ipwho: '/api/geo/ipwho',
    ipapi: '/api/geo/ipapi',
    ipinfo: '/api/geo/ipinfo',
    'ip-api': '/api/geo/ip-api',
    'geolocation-db': '/api/geo/geolocation-db',
  }

  if (mode === 'ip9') {
    const url = providerUrlMap[mode]
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
    }>(`${url}`)
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

  if (mode in providerUrlMap) {
    const url = providerUrlMap[mode]
    const data = await fetchJson<Record<string, unknown>>(`${url}`)
    const normalized = normalizeGeoRecord(data || {})
    if (normalized) {
      console.debug(`[VisitorTracker] ${mode} resolved:`, normalized)
      return normalized
    }
    console.debug(`[VisitorTracker] ${mode} response not normalized:`, data)
  }

  return null
}

function normalizeGeoRecord(record: Record<string, unknown>): VisitorGeo | null {
  const source = record && typeof record.data === 'object' && record.data !== null && !Array.isArray(record.data)
    ? { ...record, ...(record.data as Record<string, unknown>) }
    : record
  const country = String(source.country || source.country_name || source.nation || source.countryCode || source.country_code || '').trim()
  const region = String(source.region || source.region_name || source.regionName || source.prov || source.province || source.province_name || source.provinceName || source.address || '').trim()
  const city = String(source.city || source.city_name || source.cityName || source.district || '').trim()
  const latValue = source.latitude ?? source.lat
  const lonValue = source.longitude ?? source.lon ?? source.lng
  const lat = typeof latValue === 'number' ? latValue : typeof latValue === 'string' ? Number(latValue) : null
  const lon = typeof lonValue === 'number' ? lonValue : typeof lonValue === 'string' ? Number(lonValue) : null
  const countryCode = String(source.country_code || source.countryCode || source.nation_code || '').trim().toUpperCase()

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
      const geo = await resolveVisitorGeo(visitorGeoMode)
      if (cancelled) return

      const payload = JSON.stringify({
        path,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent,
        geo,
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
