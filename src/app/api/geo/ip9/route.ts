import { NextRequest, NextResponse } from 'next/server'

type IP9Response = {
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
}

export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get('ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || ''
  if (!ip) {
    return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://ip9.com.cn/get?ip=${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; VisitorTracker/1.0)',
      },
    })

    if (!response.ok) {
      console.warn('[geo/ip9] upstream error:', response.status, response.statusText)
      return NextResponse.json({ error: 'IP9 service unavailable' }, { status: 502 })
    }

    const data: IP9Response = await response.json()
    console.log('[geo/ip9] ip:', ip, 'response:', JSON.stringify(data))
    return NextResponse.json(data)
  } catch (err) {
    console.error('[geo/ip9] request failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Gateway error' }, { status: 502 })
  }
}
