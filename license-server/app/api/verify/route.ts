import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getAllowedDomains } from '../domains/route'
import { appendLog } from '../logs/route'

const SECRET = process.env.LICENSE_SECRET || ''
const ADMIN_KEY = process.env.ADMIN_KEY || ''

function hmac(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex')
}

function isAllowed(domain: string): boolean {
  const d = domain.toLowerCase()
  const allowed = getAllowedDomains()
  return allowed.some(a => d === a || d.endsWith('.' + a))
}

function generateToken(domain: string): string {
  const exp = (Date.now() + 25 * 60 * 60 * 1000).toString() // 25小时有效
  const sig = hmac(`${domain}|${exp}`)
  return Buffer.from(`${domain}|${exp}|${sig}`).toString('base64')
}

export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ valid: false, error: 'Server misconfigured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { domain, timestamp, sig, _adminKey } = body
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''

    if (!domain || !timestamp) {
      return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 })
    }

    // 管理员测试绕过（仅用于 Web UI 测试）
    const isAdminTest = ADMIN_KEY && _adminKey === ADMIN_KEY

    if (!isAdminTest) {
      // 防重放：timestamp 必须在 5 分钟内
      const ts = parseInt(timestamp)
      if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
        return NextResponse.json({ valid: false, error: 'Timestamp expired' }, { status: 401 })
      }

      // 验证请求签名
      const expected = hmac(`${domain}|${timestamp}`)
      try {
        const sigBuf = Buffer.from((sig || '').padEnd(expected.length, '0').slice(0, expected.length))
        const expBuf = Buffer.from(expected)
        if (!timingSafeEqual(sigBuf, expBuf)) {
          return NextResponse.json({ valid: false, error: 'Invalid signature' }, { status: 401 })
        }
      } catch {
        return NextResponse.json({ valid: false, error: 'Invalid signature' }, { status: 401 })
      }
    }

    // 检查域名白名单
    const authorized = isAllowed(domain)

    // 记录日志
    appendLog({ domain, time: new Date().toISOString(), authorized, ip })

    if (!authorized) {
      return NextResponse.json({ valid: false, error: 'Domain not licensed' })
    }

    const token = generateToken(domain)
    return NextResponse.json({ valid: true, token })
  } catch (e) {
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 })
  }
}

// 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    domains: ALLOWED_DOMAINS.length,
    time: new Date().toISOString(),
  })
}
