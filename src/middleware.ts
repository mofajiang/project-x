import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'
import { checkLicense } from './lib/license'

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
    const host = request.headers.get('host') || ''
    const hostname = host.split(':')[0]
    const allowed = await checkLicense(hostname)
    if (!allowed) {
      return NextResponse.redirect(new URL('/unlicensed', request.url))
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
