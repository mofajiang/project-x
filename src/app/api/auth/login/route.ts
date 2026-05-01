import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteConfig } from '@/lib/config'
import { signJWT } from '@/lib/auth'
import { syslog } from '@/lib/syslog'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const rawIp = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  const ip = /^[a-fA-F0-9.:]+$/.test(rawIp) ? rawIp : 'unknown'
  const now = Date.now()

  // 检查锁定（SQLite 持久化，重启不丢失）
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT count, lockedUntil FROM LoginFailure WHERE ip = ?`, ip)
  const fail = rows[0]
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
    const cur = fail || { count: 0, lockedUntil: 0 }
    const newCount = cur.count + 1
    const newLocked = newCount >= 5 ? now + 30 * 60 * 1000 : cur.lockedUntil
    const resetCount = newCount >= 5 ? 0 : newCount
    await prisma.$executeRawUnsafe(
      `INSERT INTO LoginFailure (ip, count, lockedUntil, updatedAt)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET count=excluded.count, lockedUntil=excluded.lockedUntil, updatedAt=excluded.updatedAt`,
      ip,
      resetCount,
      newLocked,
      now
    )
    syslog.warn('auth', `登录失败: ${username}`, { ip }).catch(() => {})
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  // 清除失败记录
  await prisma.$executeRawUnsafe(`DELETE FROM LoginFailure WHERE ip = ?`, ip)

  syslog.info('auth', `登录成功: ${user.username}`, { ip }).catch(() => {})
  const token = await signJWT({ userId: user.id, username: user.username })

  // 根据实际协议决定 secure 标志：
  // 直接 HTTP 访问时为 false，通过 HTTPS 反向代理时为 true
  const proto = req.headers.get('x-forwarded-proto')
  const isSecure = proto === 'https' || req.url.startsWith('https://')

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  // 记录登录路径，供 middleware 识别动态登录页跳过 license 检查
  res.cookies.set('_lpx', config.loginPath.replace(/^\//, ''), {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}
