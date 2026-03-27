import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'
import { checkLicense } from './lib/license'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 授权验证（跳过 unlicensed、静态资源、API、后台路由、登录相关路径）
  // 登录路径为动态单段路由，无法预知具体值，但可通过 cookie 中缓存的路径跳过
  const loginPathCookie = request.cookies.get('_lpx')?.value || 'admin-login'
  const isLoginPage = pathname === `/${loginPathCookie}` || pathname === '/admin-login'
  if (
    !pathname.startsWith('/unlicensed') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/favicon') &&
    !pathname.startsWith('/admin') &&
    !isLoginPage
  ) {
    const host = request.headers.get('host') || ''
    const domain = host.split(':')[0] // 去掉端口
    const licensed = await checkLicense(domain)
    if (!licensed) {
      return NextResponse.redirect(new URL('/unlicensed', request.url))
    }
  }

  // 保护后台路由（/admin 下的路由，动态登录路径不在此处理）
  if (pathname.startsWith('/admin')) {
    const session = await getSessionFromRequest(request)
    if (!session) {
      // 未登录重定向到首页（登录路径为动态值，middleware 无法读数据库）
      return NextResponse.redirect(new URL('/', request.url))
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
