import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

async function geolocateIp(ip: string) {
  if (!isPublicIp(ip)) return {}
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return {}
    const data = await res.json() as GeoResult
    return {
      country: data.country || '',
      countryCode: data.country_code || '',
      region: data.region || '',
      city: data.city || '',
      lat: typeof data.latitude === 'number' ? data.latitude : null,
      lon: typeof data.longitude === 'number' ? data.longitude : null,
    }
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  await runMigrations()

  let payload: { path?: string; referrer?: string; userAgent?: string } = {}
  try {
    payload = await req.json()
  } catch {}

  const ip = getClientIp(req)
  const geo = await geolocateIp(ip)

  try {
    await prisma.visitor.create({
      data: {
        ip,
        path: (payload.path || '/').slice(0, 500),
        referrer: (payload.referrer || '').slice(0, 500),
        userAgent: (payload.userAgent || req.headers.get('user-agent') || '').slice(0, 500),
        country: (geo.country || '').slice(0, 100),
        countryCode: (geo.countryCode || '').slice(0, 12),
        region: (geo.region || '').slice(0, 100),
        city: (geo.city || '').slice(0, 100),
        lat: geo.lat,
        lon: geo.lon,
      },
    })
  } catch (e) {
    console.warn('[track-visit]', e)
  }

  return NextResponse.json({ ok: true })
}
