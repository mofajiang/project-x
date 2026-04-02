import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSiteConfig } from '@/lib/config'
import { runMigrations } from '@/lib/db-migrate'
import { getClientIp, isPublicIp } from '@/lib/request-ip'

type GeoResult = {
  country?: string
  country_code?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
}

type NormalizedGeo = {
  country: string
  countryCode: string
  region: string
  city: string
  lat: number | null
  lon: number | null
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

function normalizeGeo(data: Partial<GeoResult> & { countryCode?: string; regionName?: string; lat?: number; lon?: number }): NormalizedGeo {
  return {
    country: (data.country || '').trim(),
    countryCode: (data.country_code || data.countryCode || '').trim(),
    region: (data.region || data.regionName || '').trim(),
    city: (data.city || '').trim(),
    lat: typeof data.latitude === 'number' ? data.latitude : typeof data.lat === 'number' ? data.lat : null,
    lon: typeof data.longitude === 'number' ? data.longitude : typeof data.lon === 'number' ? data.lon : null,
  }
}

async function geolocateIp(ip: string) {
  if (!isPublicIp(ip)) return EMPTY_GEO

  const config = await getSiteConfig().catch(() => null)
  const geoMode = config?.visitorGeoMode || 'offline'
  const customEndpoint = config?.visitorGeoEndpoint?.trim() || ''

  if (geoMode === 'custom' && customEndpoint) {
    try {
      const endpoint = customEndpoint.includes('{ip}')
        ? customEndpoint.replaceAll('{ip}', encodeURIComponent(ip))
        : `${customEndpoint}${customEndpoint.includes('?') ? '&' : '?'}ip=${encodeURIComponent(ip)}`
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json() as Partial<GeoResult> & { countryCode?: string; regionName?: string; lat?: number; lon?: number }
        const normalized = normalizeGeo({
          country: toCountryName(data.country || data.country_code || data.countryCode || ''),
          country_code: (data.country_code || data.countryCode || '').toUpperCase(),
          region: data.region || data.regionName,
          city: data.city,
          latitude: data.latitude ?? data.lat,
          longitude: data.longitude ?? data.lon,
        })
        if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
          return normalized
        }
      }
    } catch {
      return lookupOfflineGeo(ip)
    }
  }

  return lookupOfflineGeo(ip)
}

export async function POST(req: NextRequest) {
  await runMigrations()

  let payload: { path?: string; referrer?: string; userAgent?: string } = {}
  try {
    payload = await req.json()
  } catch {}

  const ip = getClientIp(req)
  const geo = await geolocateIp(ip)
  const createdAt = new Date().toISOString()

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
  } catch (e) {
    console.warn('[track-visit]', e)
  }

  return NextResponse.json({ ok: true })
}
