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

type TencentIpResult = {
  ret?: number
  errMsg?: string
  ip?: string
  country?: string
  province?: string
  city?: string
  district?: string
  isp?: string
  provcode?: string
  citycode?: string
  districtCode?: string
}

type IpstackResult = {
  success?: boolean
  error?: { info?: string }
  country_code?: string
  country_name?: string
  region_name?: string
  city?: string
  latitude?: number
  longitude?: number
}

type IpipLocationResult = {
  country_name?: string
  region_name?: string
  city_name?: string
  latitude?: string | number
  longitude?: string | number
  country_code?: string
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

function normalizeIpipArray(data: unknown[]): NormalizedGeo {
  const country = typeof data[0] === 'string' ? data[0] : ''
  const region = typeof data[1] === 'string' ? data[1] : ''
  const city = typeof data[2] === 'string' ? data[2] : ''
  const countryCode = typeof data[10] === 'string' ? data[10].trim().toUpperCase() : ''
  const latValue = typeof data[5] === 'string' || typeof data[5] === 'number' ? Number(data[5]) : Number.NaN
  const lonValue = typeof data[6] === 'string' || typeof data[6] === 'number' ? Number(data[6]) : Number.NaN

  return {
    country: country.trim(),
    countryCode,
    region: region.trim(),
    city: city.trim(),
    lat: Number.isFinite(latValue) ? latValue : null,
    lon: Number.isFinite(lonValue) ? lonValue : null,
  }
}

function normalizeIpipLocation(data: IpipLocationResult): NormalizedGeo {
  return {
    country: (data.country_name || '').trim(),
    countryCode: (data.country_code || '').trim().toUpperCase(),
    region: (data.region_name || '').trim(),
    city: (data.city_name || '').trim(),
    lat: typeof data.latitude === 'number' ? data.latitude : typeof data.latitude === 'string' ? Number(data.latitude) : null,
    lon: typeof data.longitude === 'number' ? data.longitude : typeof data.longitude === 'string' ? Number(data.longitude) : null,
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

async function geolocateIp(ip: string) {
  if (!isPublicIp(ip)) return EMPTY_GEO

  const config = await getSiteConfig().catch(() => null)
  const geoMode = config?.visitorGeoMode || 'tencent'
  const geoKey = config?.visitorGeoKey?.trim() || ''
  const customEndpoint = config?.visitorGeoEndpoint?.trim() || ''

  if (geoMode === 'tencent') {
    const data = await fetchJson<TencentIpResult>('https://r.inews.qq.com/api/ip2city')
    if (data) {
      const province = (data.province || '').trim()
      const city = (data.city || '').trim()
      const district = (data.district || '').trim()
      const country = (data.country || '').trim()
      return {
        country: country || '中国',
        countryCode: country === '中国' || !country ? 'CN' : '',
        region: [province, city, district].filter(Boolean).join(' '),
        city: city || district || province,
        lat: null,
        lon: null,
      }
    }
    return lookupOfflineGeo(ip)
  }

  if (geoMode === 'ipstack') {
    if (!geoKey) return lookupOfflineGeo(ip)
    const endpoint = `https://api.ipstack.com/${encodeURIComponent(ip)}?access_key=${encodeURIComponent(geoKey)}&language=zh&output=json&fields=country_code,country_name,region_name,city,latitude,longitude`
    const data = await fetchJson<IpstackResult>(endpoint)
    if (data && data.success !== false && !data.error) {
      const normalized = normalizeGeo({
        country: toCountryName(data.country_name || data.country_code || ''),
        country_code: data.country_code,
        region: data.region_name,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
        return normalized
      }
    }
    return lookupOfflineGeo(ip)
  }

  if (geoMode === 'ipip') {
    if (geoKey) {
      const data = await fetchJson<{ ret?: string; data?: { location?: IpipLocationResult } }>(`https://ipapi.ipip.net/query/${encodeURIComponent(ip)}`, {
        headers: { Token: geoKey },
      })
      const location = data?.data?.location
      if (data?.ret === 'ok' && location) {
        const normalized = normalizeIpipLocation(location)
        if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
          return normalized
        }
      }
    }

    const freeData = await fetchJson<unknown[]>(`http://freeapi.ipip.net/${encodeURIComponent(ip)}`)
    if (Array.isArray(freeData)) {
      const normalized = normalizeIpipArray(freeData)
      if (normalized.country || normalized.countryCode || normalized.region || normalized.city || normalized.lat !== null || normalized.lon !== null) {
        return normalized
      }
    }

    return lookupOfflineGeo(ip)
  }

  if (geoMode === 'custom' && customEndpoint) {
    const endpoint = customEndpoint.includes('{ip}')
      ? customEndpoint.replaceAll('{ip}', encodeURIComponent(ip))
      : `${customEndpoint}${customEndpoint.includes('?') ? '&' : '?'}ip=${encodeURIComponent(ip)}`
    const data = await fetchJson<Partial<GeoResult> & { countryCode?: string; regionName?: string; lat?: number; lon?: number }>(endpoint)
    if (data) {
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
    return lookupOfflineGeo(ip)
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
