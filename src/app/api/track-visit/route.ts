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

export async function POST(req: NextRequest) {
  await runMigrations()

  let payload: { path?: string; referrer?: string; userAgent?: string; geo?: IncomingGeo } = {}
  try {
    payload = await req.json()
  } catch {}

  const ip = getClientIp(req)
  const geo = normalizeIncomingGeo(payload.geo) || (isPublicIp(ip) ? lookupOfflineGeo(ip) : EMPTY_GEO)
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
