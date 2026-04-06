import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

// Edge Runtime 兼容的 HMAC-SHA256（Web Crypto API）
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 编码配置（运行时组装）
const _a = (s: number[]) => s.map(c => String.fromCharCode(c)).join('')
const _b = (s: string) => atob(s)
const _s1 = _a([104,116,116,112,115,58,47,47])
const _s2 = _b('cHJvamVjdC14')
const _s3 = _a([46,104,97,116,104,115,46,110,101,116])
const LICENSE_SERVER = process.env.LICENSE_SERVER_URL || (_s1 + _s2 + _s3)
const _k  = [122, 53, 78, 63,118, 95, 44,101,111,118, 90, 83,114, 87]
const _xk = [ 42, 71, 33, 85, 19, 60, 88, 72, 55, 91, 24, 63, 29, 48]
const LICENSE_SECRET = process.env.LICENSE_SECRET || _a(_k.map((c, i) => c ^ _xk[i]))

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 跳过静态资源、API、/unlicensed 页面本身
  const skipLicense =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/unlicensed') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/feed.xml'

  if (!skipLicense) {
    const forwarded = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const hostname = forwarded.split(':')[0]
    let allowed = false
    try {
      const timestamp = Date.now().toString()
      const sig = await hmacSign(`${hostname}|${timestamp}`, LICENSE_SECRET)
      const res = await fetch(`${LICENSE_SERVER}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: hostname, timestamp, sig }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        allowed = data.valid === true
      }
    } catch {
      allowed = false
    }
    if (!allowed) {
      const url = new URL('/unlicensed', request.url)
      url.searchParams.set('host', hostname)
      return NextResponse.redirect(url)
    }
  }

  // 保护后台路由（精确匹配 /admin 或 /admin/ 开头，避免误拦截 /admin-login 等路径）
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads).*)',
  ],
}
