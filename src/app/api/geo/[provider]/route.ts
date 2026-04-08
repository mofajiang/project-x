import { NextRequest, NextResponse } from 'next/server'

const DEBUG = process.env.NODE_ENV === 'development'

const GEO_PROVIDERS: Record<string, (ip: string) => string> = {
  ipwho: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
  ipinfo: (ip) => `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
  ipapi: (ip) => `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
  'ip-api': (ip) =>
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`,
  ip9: (ip) => `https://ip9.com.cn/get?ip=${encodeURIComponent(ip)}`,
  'geolocation-db': (ip) => `https://geolocation-db.com/json/${encodeURIComponent(ip)}?position=true`,
}

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const { provider } = params
  const buildUrl = GEO_PROVIDERS[provider]
  if (!buildUrl) {
    return NextResponse.json({ error: 'Unknown geo provider' }, { status: 404 })
  }

  const ip =
    req.nextUrl.searchParams.get('ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    ''

  if (!ip) {
    return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 })
  }

  try {
    const response = await fetch(buildUrl(ip), {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; VisitorTracker/1.0)',
      },
    })

    if (!response.ok) {
      console.warn(`[geo/${provider}] upstream error:`, response.status, response.statusText)
      return NextResponse.json({ error: `${provider} service unavailable` }, { status: 502 })
    }

    const data = await response.json()
    if (DEBUG) console.log(`[geo/${provider}] ip:`, ip, 'response:', JSON.stringify(data))
    return NextResponse.json(data)
  } catch (err) {
    console.error(`[geo/${provider}] request failed:`, err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Gateway error' }, { status: 502 })
  }
}
