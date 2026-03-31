import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 跳过静态资源、API、/unlicensed 页面本身
  const skipLicense =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/unlicensed') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/feed.xml'

  if (!skipLicense) {
    const forwarded = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const hostname = forwarded.split(':')[0]
    try {
      // 调用内部 Node.js API 路由做授权检查（绕开 Edge Runtime crypto 限制）
      const checkUrl = new URL('/api/license-check-internal', request.url)
      checkUrl.searchParams.set('host', hostname)
      const res = await fetch(checkUrl.toString(), { signal: AbortSignal.timeout(9000) })
      const data = await res.json()
      if (!data.valid) {
        const url = new URL('/unlicensed', request.url)
        url.searchParams.set('host', hostname)
        return NextResponse.redirect(url)
      }
    } catch {
      // 内部调用异常时放行，避免因自身故障锁死访问
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
