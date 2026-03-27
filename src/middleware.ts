import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'
import { checkLicense } from './lib/license'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 授权验证（跳过 unlicensed 页自身、静态资源、API）
  if (
    !pathname.startsWith('/unlicensed') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/favicon')
  ) {
    const host = request.headers.get('host') || ''
    const domain = host.split(':')[0] // 去掉端口
    const licensed = await checkLicense(domain)
    if (!licensed) {
      return NextResponse.redirect(new URL('/unlicensed', request.url))
    }
  }

  // 保护后台路由（登录页本身放行）
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next()
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  // 动态登录路径检查：拦截 /login 防止直接访问
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/((?!_next/static|_next/image|favicon.ico|unlicensed).*)',
  ],
}
