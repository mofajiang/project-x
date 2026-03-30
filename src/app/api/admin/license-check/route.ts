import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { checkLicense } from '@/lib/license'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 优先使用 NEXT_PUBLIC_SITE_URL，避免取到 localhost
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  let currentHost = ''
  try {
    if (siteUrl) {
      currentHost = new URL(siteUrl).hostname
    } else {
      // 没有配置 NEXT_PUBLIC_SITE_URL，尝试从 x-forwarded-host 或 host 获取真实域名
      const forwarded = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
      currentHost = forwarded.split(':')[0]
    }
  } catch {
    currentHost = (req.headers.get('host') || '').split(':')[0]
  }

  // 如果仍然是 localhost/127.x，说明 NEXT_PUBLIC_SITE_URL 未配置
  const isLocal = currentHost.startsWith('localhost') || currentHost.startsWith('127.') || currentHost.startsWith('192.168.')
  if (isLocal) {
    return NextResponse.json({
      authorized: false,
      domains: [],
      currentHost,
      error: 'NEXT_PUBLIC_SITE_URL 未配置，无法检测真实域名授权状态'
    })
  }

  try {
    // 直接复用 middleware 的 checkLicense（HMAC 签名验证），保持一致
    const authorized = await checkLicense(currentHost)
    return NextResponse.json({ authorized, domains: [], currentHost })
  } catch {
    return NextResponse.json({ authorized: false, domains: [], currentHost, error: 'cannot reach license server' })
  }
}
