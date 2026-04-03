import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { getClientIp, isPublicIp } from '@/lib/request-ip'

type NormalizedGeo = {
  country: string
  countryCode: string
  region: string
  city: string
  lat: number | null
  lon: number | null
}

type IncomingGeo = {
  country?: string
  countryCode?: string
  region?: string
  city?: string
  lat?: number | string | null
  lon?: number | string | null
}

type IncomingPayload = {
  path?: string
  referrer?: string
  userAgent?: string
  geo?: IncomingGeo
  geoMode?: string
  geoEndpoint?: string
  geoKey?: string
}

const EMPTY_GEO: NormalizedGeo = {
  country: '',
  countryCode: '',
  region: '',
  city: '',
  lat: null,
  lon: null,
}

const countryNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['zh-Hans'], { type: 'region' })
  : null

function toCountryName(codeOrName: string) {
  const value = codeOrName.trim()
  if (!value) return ''
  if (/^[A-Z]{2}$/i.test(value)) {
    return countryNames?.of(value.toUpperCase()) || value.toUpperCase()
  }
  return value
}

function lookupOfflineGeo(ip: string): NormalizedGeo {
  try {
    const geoip = require('geoip-lite') as { lookup: (value: string) => { country?: string; region?: string; city?: string; ll?: [number, number] } | null }
    const result = geoip.lookup(ip)
    if (!result) return EMPTY_GEO
    return {
      country: toCountryName(result.country || ''),
      countryCode: (result.country || '').trim().toUpperCase(),
      region: (result.region || '').trim(),
      city: (result.city || '').trim(),
      lat: Array.isArray(result.ll) ? result.ll[0] ?? null : null,
      lon: Array.isArray(result.ll) ? result.ll[1] ?? null : null,
    }
  } catch {
    return EMPTY_GEO
  }
}

function normalizeIncomingGeo(data: unknown): NormalizedGeo | null {
  if (!data || typeof data !== 'object') return null
  const record = data as IncomingGeo
  const lat = typeof record.lat === 'string' ? Number(record.lat) : typeof record.lat === 'number' ? record.lat : null
  const lon = typeof record.lon === 'string' ? Number(record.lon) : typeof record.lon === 'number' ? record.lon : null
  const normalized: NormalizedGeo = {
    country: toCountryName(record.country || record.countryCode || ''),
    countryCode: (record.countryCode || '').trim().toUpperCase(),
    region: (record.region || '').trim(),
    city: (record.city || '').trim(),
    lat: Number.isFinite(lat as number) ? lat : null,
    lon: Number.isFinite(lon as number) ? lon : null,
  }
  if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
    return normalized
  }
  return null
}

function normalizeRemoteGeo(data: unknown): NormalizedGeo | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const source = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? { ...record, ...(record.data as Record<string, unknown>) }
    : record

  const latValue = source.latitude ?? source.lat
  const lonValue = source.longitude ?? source.lon ?? source.lng
  const lat = typeof latValue === 'string' ? Number(latValue) : typeof latValue === 'number' ? latValue : null
  const lon = typeof lonValue === 'string' ? Number(lonValue) : typeof lonValue === 'number' ? lonValue : null
  const normalized: NormalizedGeo = {
    country: toCountryName(String(source.country || source.country_name || source.countryCode || source.country_code || source.nation || '').trim()),
    countryCode: String(source.country_code || source.countryCode || source.nation_code || '').trim().toUpperCase(),
    region: String(source.region || source.region_name || source.regionName || source.prov || source.province || source.province_name || source.provinceName || source.address || '').trim(),
    city: String(source.city || source.city_name || source.cityName || source.district || '').trim(),
    lat: Number.isFinite(lat as number) ? lat : null,
    lon: Number.isFinite(lon as number) ? lon : null,
  }
  if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
    return normalized
  }
  return null
}

async function fetchRemoteGeo(endpoint: string, key: string, clientIp: string) {
  const cleanEndpoint = endpoint.trim()
  if (!cleanEndpoint) return null

  let resolvedEndpoint = cleanEndpoint
  if (cleanEndpoint.includes('{ip}')) {
    resolvedEndpoint = cleanEndpoint.replaceAll('{ip}', encodeURIComponent(clientIp))
  } else {
    const joiner = cleanEndpoint.includes('?') ? '&' : '?'
    resolvedEndpoint = `${cleanEndpoint}${joiner}ip=${encodeURIComponent(clientIp)}`
  }

  const headers = new Headers({ Accept: 'application/json' })
  if (key.trim()) {
    headers.set('Authorization', `Bearer ${key.trim()}`)
  }

  try {
    const response = await fetch(resolvedEndpoint, { signal: AbortSignal.timeout(5000), headers })
    if (!response.ok) {
      console.warn('[track-visit] remote geo fetch failed:', response.status, response.statusText)
      return null
    }
    const data = await response.json()
    return normalizeRemoteGeo(data)
  } catch (error) {
    console.warn('[track-visit] remote geo fetch error:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function POST(req: NextRequest) {
  await runMigrations()

  let payload: IncomingPayload = {}
  try {
    payload = await req.json()
  } catch {}

  const ip = getClientIp(req)
  const incomingGeo = normalizeIncomingGeo(payload.geo)
  const resolvedCustomGeo = !incomingGeo && payload.geoMode === 'custom' && payload.geoEndpoint
    ? await fetchRemoteGeo(payload.geoEndpoint, payload.geoKey || '', ip)
    : null
  const geo = incomingGeo || resolvedCustomGeo || (isPublicIp(ip) ? lookupOfflineGeo(ip) : EMPTY_GEO)
  const createdAt = new Date().toISOString()
  
  // Debug logging
  console.log('[track-visit] client_ip:', ip, 'is_public:', isPublicIp(ip))
  console.log('[track-visit] payload.geo:', JSON.stringify(payload.geo))
  console.log('[track-visit] payload.geoMode:', payload.geoMode, 'payload.geoEndpoint:', payload.geoEndpoint)
  console.log('[track-visit] normalized_geo:', incomingGeo ? JSON.stringify(incomingGeo) : 'null')
  console.log('[track-visit] resolved_custom_geo:', resolvedCustomGeo ? JSON.stringify(resolvedCustomGeo) : 'null')
  console.log('[track-visit] final_geo:', JSON.stringify(geo))

  try {
    await prisma.$executeRaw`
      INSERT INTO Visitor (
        id, ip, path, userAgent, referrer,
        country, countryCode, region, city, lat, lon, createdAt
      ) VALUES (
        ${randomUUID()},
        ${ip},
        ${(payload.path || '/').slice(0, 500)},
        ${(payload.userAgent || req.headers.get('user-agent') || '').slice(0, 500)},
        ${(payload.referrer || '').slice(0, 500)},
        ${(geo.country || '').slice(0, 100)},
        ${(geo.countryCode || '').slice(0, 12)},
        ${(geo.region || '').slice(0, 100)},
        ${(geo.city || '').slice(0, 100)},
        ${geo.lat},
        ${geo.lon},
        ${createdAt}
      )
    `
    console.log('[track-visit] success: saved visitor record')
  } catch (e) {
    console.warn('[track-visit] db error:', e)
  }

  return NextResponse.json({ ok: true })
}
