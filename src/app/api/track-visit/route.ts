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

  const locValue = source.loc ?? source.Loc ?? source.LOC
  const locParts = typeof locValue === 'string' ? locValue.split(',').map(part => part.trim()) : []
  const latValue = source.latitude ?? source.lat ?? (locParts[0] || undefined)
  const lonValue = source.longitude ?? source.lon ?? source.lng ?? (locParts[1] || undefined)
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

async function resolveProviderGeo(mode: string | undefined, clientIp: string, req: NextRequest): Promise<NormalizedGeo | null> {
  if (!mode || mode === 'offline') return null

  const builtins: Record<string, string> = {
    ip9: '/api/geo/ip9',
    ipwho: '/api/geo/ipwho',
    ipapi: '/api/geo/ipapi',
    ipinfo: '/api/geo/ipinfo',
    'ip-api': '/api/geo/ip-api',
    'geolocation-db': '/api/geo/geolocation-db',
  }

  const fallbackOrder: Record<string, string[]> = {
    ip9: ['ip9', 'ipinfo', 'ip-api', 'geolocation-db'],
    ipwho: ['ipwho', 'ipinfo', 'ip-api', 'geolocation-db'],
    ipapi: ['ipapi', 'ipinfo', 'ip-api', 'geolocation-db'],
    ipinfo: ['ipinfo', 'ip-api', 'geolocation-db', 'ip9'],
    'ip-api': ['ip-api', 'ipinfo', 'geolocation-db', 'ip9'],
    'geolocation-db': ['geolocation-db', 'ipinfo', 'ip-api', 'ip9'],
  }

  const providers = fallbackOrder[mode] || [mode]
  for (const provider of providers) {
    if (!(provider in builtins)) continue
    try {
      const url = new URL(builtins[provider], req.url)
      url.searchParams.set('ip', clientIp)
      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } })
      if (!response.ok) {
        console.warn('[track-visit] provider geo fetch failed:', provider, response.status, response.statusText)
        continue
      }
      const data = await response.json()
      const normalized = normalizeRemoteGeo(data)
      if (normalized) {
        if (provider !== mode) {
          console.warn(`[track-visit] provider ${mode} failed, fallback to ${provider}`)
        }
        return normalized
      }
      console.warn('[track-visit] provider geo response not normalized:', provider, data)
    } catch (error) {
      console.warn('[track-visit] provider geo fetch error:', provider, error instanceof Error ? error.message : String(error))
    }
  }

  return null
}

async function lookupGeoCache(ip: string): Promise<NormalizedGeo | null> {
  if (!ip || !isPublicIp(ip)) return null
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT country, countryCode, region, city, lat, lon FROM VisitorGeoCache WHERE ip = ?`,
      ip,
    )
    const row = rows?.[0]
    if (!row) return null
    return {
      country: String(row.country || '').trim(),
      countryCode: String(row.countryCode || '').trim().toUpperCase(),
      region: String(row.region || '').trim(),
      city: String(row.city || '').trim(),
      lat: Number.isFinite(row.lat) ? Number(row.lat) : null,
      lon: Number.isFinite(row.lon) ? Number(row.lon) : null,
    }
  } catch {
    return null
  }
}

async function upsertGeoCache(ip: string, geo: NormalizedGeo) {
  if (!ip) return
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO VisitorGeoCache (ip, country, countryCode, region, city, lat, lon, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET
         country = excluded.country,
         countryCode = excluded.countryCode,
         region = excluded.region,
         city = excluded.city,
         lat = excluded.lat,
         lon = excluded.lon,
         updatedAt = excluded.updatedAt`,
      ip,
      geo.country || '',
      geo.countryCode || '',
      geo.region || '',
      geo.city || '',
      geo.lat,
      geo.lon,
      new Date().toISOString(),
    )
  } catch {
    // ignore cache failures
  }
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
  let geo: NormalizedGeo | null = incomingGeo || null
  let resolvedCustomGeo: NormalizedGeo | null = null
  let cacheGeo: NormalizedGeo | null = null

  if (!geo) {
    if (payload.geoMode === 'custom' && payload.geoEndpoint) {
      resolvedCustomGeo = await fetchRemoteGeo(payload.geoEndpoint, payload.geoKey || '', ip)
      if (resolvedCustomGeo) {
        geo = resolvedCustomGeo
        await upsertGeoCache(ip, resolvedCustomGeo)
      }
    }

    if (!geo) {
      const providerGeo = await resolveProviderGeo(payload.geoMode, ip, req)
      if (providerGeo) {
        geo = providerGeo
        await upsertGeoCache(ip, providerGeo)
      }
    }

    if (!geo && isPublicIp(ip)) {
      cacheGeo = await lookupGeoCache(ip)
      if (cacheGeo) {
        geo = cacheGeo
      } else {
        geo = lookupOfflineGeo(ip)
        if (geo && (geo.country || geo.countryCode || geo.region || geo.city || geo.lat !== null || geo.lon !== null)) {
          await upsertGeoCache(ip, geo)
        }
      }
    }
  }

  if (!geo) geo = EMPTY_GEO
  const createdAt = new Date().toISOString()
  const visitDay = createdAt.slice(0, 10)

  // Debug logging
  console.log('[track-visit] client_ip:', ip, 'is_public:', isPublicIp(ip))
  console.log('[track-visit] payload.geo:', JSON.stringify(payload.geo))
  console.log('[track-visit] payload.geoMode:', payload.geoMode, 'payload.geoEndpoint:', payload.geoEndpoint)
  console.log('[track-visit] normalized_geo:', incomingGeo ? JSON.stringify(incomingGeo) : 'null')
  console.log('[track-visit] resolved_custom_geo:', resolvedCustomGeo ? JSON.stringify(resolvedCustomGeo) : 'null')
  console.log('[track-visit] cached_geo:', cacheGeo ? JSON.stringify(cacheGeo) : 'null')
  console.log('[track-visit] final_geo:', JSON.stringify(geo))

  try {
    await prisma.$executeRaw`
      INSERT INTO Visitor (
        id, ip, path, userAgent, referrer,
        country, countryCode, region, city, lat, lon, visitDay, createdAt
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
        ${visitDay},
        ${createdAt}
      )
    `
    console.log('[track-visit] success: saved visitor record')
  } catch (e) {
    console.warn('[track-visit] db error:', e)
  }

  return NextResponse.json({ ok: true })
}
