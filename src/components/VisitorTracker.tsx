'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type GeoMode = 'offline' | 'tencent' | 'ipstack' | 'ipip' | 'custom' | string

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
}

function toCountryName(value: string) {
  const text = value.trim()
  if (!text) return ''
  if (/^[A-Z]{2}$/i.test(text)) {
    const names = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['zh-Hans'], { type: 'region' })
      : null
    return names?.of(text.toUpperCase()) || text.toUpperCase()
  }
  return text
}

function normalizeGeoRecord(record: Record<string, unknown>): VisitorGeo | null {
  const country = String(record.country || record.country_name || record.countryCode || record.country_code || '').trim()
  const region = String(record.region || record.region_name || record.regionName || '').trim()
  const city = String(record.city || record.city_name || '').trim()
  const latValue = record.latitude ?? record.lat
  const lonValue = record.longitude ?? record.lon
  const lat = typeof latValue === 'number' ? latValue : typeof latValue === 'string' ? Number(latValue) : null
  const lon = typeof lonValue === 'number' ? lonValue : typeof lonValue === 'string' ? Number(lonValue) : null
  const countryCode = String(record.country_code || record.countryCode || '').trim().toUpperCase()

  const normalized: VisitorGeo = {
    country: toCountryName(country || countryCode),
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

function normalizeGeoText(text: string): VisitorGeo | null {
  const raw = text.trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const country = typeof parsed[0] === 'string' ? parsed[0].trim() : ''
      const region = typeof parsed[1] === 'string' ? parsed[1].trim() : ''
      const city = typeof parsed[2] === 'string' ? parsed[2].trim() : ''
      const countryCode = typeof parsed[10] === 'string' ? parsed[10].trim().toUpperCase() : ''
      return {
        country: toCountryName(country || countryCode),
        countryCode,
        region,
        city,
        lat: null,
        lon: null,
      }
    }
    if (parsed && typeof parsed === 'object') {
      return normalizeGeoRecord(parsed as Record<string, unknown>)
    }
  } catch {}

  const parts = raw
    .replace(/[|]/g, ' ')
    .split(/\s+|,|，|\-|\/|\|/)
    .map(item => item.trim())
    .filter(Boolean)

  if (parts.length > 1) {
    return {
      country: toCountryName(parts[0]),
      countryCode: '',
      region: parts[1] || '',
      city: parts[2] || parts[1] || '',
      lat: null,
      lon: null,
    }
  }

  return {
    country: toCountryName(raw),
    countryCode: '',
    region: '',
    city: '',
    lat: null,
    lon: null,
  }
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null
    return await response.text()
  } catch {
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

async function resolveVisitorGeo(mode: GeoMode, endpoint: string) {
  if (!mode || mode === 'offline') return null

  if (mode === 'tencent') {
    const text = await fetchText('https://r.inews.qq.com/api/ip2city')
    return text ? normalizeGeoText(text) : null
  }

  if (mode === 'ipstack') {
    const text = await fetchText('https://iplark.com/ipstack')
    return text ? normalizeGeoText(text) : null
  }

  if (mode === 'ipip') {
    const ip = await fetchPublicIp()
    if (!ip) return null
    const text = await fetchText(`https://freeapi.ipip.net/${encodeURIComponent(ip)}`)
    return text ? normalizeGeoText(text) : null
  }

  if (mode === 'custom' && endpoint.trim()) {
    const cleanEndpoint = endpoint.trim()
    if (cleanEndpoint.includes('{ip}')) {
      const ip = await fetchPublicIp()
      if (!ip) return null
      const text = await fetchText(cleanEndpoint.replaceAll('{ip}', encodeURIComponent(ip)))
      return text ? normalizeGeoText(text) : null
    }
    const text = await fetchText(cleanEndpoint)
    return text ? normalizeGeoText(text) : null
  }

  return null
}

export function VisitorTracker({ visitorGeoMode = 'offline', visitorGeoEndpoint = '' }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    let cancelled = false

    const send = async () => {
      const query = window.location.search.replace(/^\?/, '')
      const path = query ? `${pathname}?${query}` : pathname
      const geo = await resolveVisitorGeo(visitorGeoMode, visitorGeoEndpoint)
      if (cancelled) return

      const payload = JSON.stringify({
        path,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent,
        geo,
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
    }

    send().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [pathname, visitorGeoEndpoint, visitorGeoMode])

  return null
}
