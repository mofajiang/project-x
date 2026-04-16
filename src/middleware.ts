import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

// Edge Runtime 兼容的 HMAC-SHA256（Web Crypto API）
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// LICENSE_SERVER and LICENSE_SECRET must be supplied via environment variables.
// If LICENSE_SECRET is absent the middleware skips HMAC verification and allows
// all requests through, so deployments without a license server are unaffected.
const LICENSE_SERVER = process.env.LICENSE_SERVER_URL ?? ''
const LICENSE_SECRET = process.env.LICENSE_SECRET ?? ''

// 授权结果内存缓存（每个 Edge Worker 实例独立）
const licenseCache = new Map<string, { allowed: boolean; expires: number }>()
const LICENSE_CACHE_TTL = 60 * 60 * 1000 // 1 小时

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

  // Skip license verification entirely when the server is not configured.
  // This keeps self-hosted deployments without a license server fully functional.
  if (!skipLicense && LICENSE_SERVER && LICENSE_SECRET) {
    const forwarded = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const hostname = forwarded.split(':')[0]

    // 检查缓存
    const cached = licenseCache.get(hostname)
    let allowed = false
    if (cached && cached.expires > Date.now()) {
      allowed = cached.allowed
    } else {
      try {
        const timestamp = Date.now().toString()
        const sig = await hmacSign(`${hostname}|${timestamp}`, LICENSE_SECRET)
        const res = await fetch(`${LICENSE_SERVER}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: hostname, timestamp, sig }),
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          const data = await res.json()
          allowed = data.valid === true
        }
      } catch {
        // 网络异常时：如果之前验证通过过，沿用旧结果
        if (cached?.allowed) {
          allowed = true
        }
      }
      licenseCache.set(hostname, { allowed, expires: Date.now() + LICENSE_CACHE_TTL })
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
}
