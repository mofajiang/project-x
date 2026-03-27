import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteConfig } from '@/lib/config'
import { signJWT } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// 简单内存限流：登录失败计数
const failMap = new Map<string, { count: number; lockedUntil: number }>()

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()

  // 检查锁定
  const fail = failMap.get(ip)
  if (fail && fail.lockedUntil > now) {
    const mins = Math.ceil((fail.lockedUntil - now) / 60000)
    return NextResponse.json({ error: `登录失败次数过多，请 ${mins} 分钟后再试` }, { status: 429 })
  }

  const { username, password, loginPath } = await req.json()

  // 验证登录路径令牌：允许内置后台登录页 或 自定义登录路径
  const config = await getSiteConfig()
  const isInternalLogin = loginPath === '/admin/login' || !loginPath
  if (!isInternalLogin && loginPath !== config.loginPath) {
    return NextResponse.json({ error: '无效请求' }, { status: 403 })
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
  })

  const valid = user && (await bcrypt.compare(password, user.password))

  if (!valid) {
    const cur = failMap.get(ip) || { count: 0, lockedUntil: 0 }
    cur.count += 1
    if (cur.count >= 5) {
      cur.lockedUntil = now + 30 * 60 * 1000
      cur.count = 0
    }
    failMap.set(ip, cur)
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  // 清除失败记录
  failMap.delete(ip)

  const token = await signJWT({ userId: user.id, username: user.username })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
