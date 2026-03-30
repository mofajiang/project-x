import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { checkLicense } from '@/lib/license'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 从 NEXT_PUBLIC_SITE_URL 或请求 host 获取当前域名
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  let currentHost = ''
  try {
    currentHost = siteUrl ? new URL(siteUrl).hostname : (req.headers.get('host') || '').split(':')[0]
  } catch {
    currentHost = (req.headers.get('host') || '').split(':')[0]
  }

  try {
    // 直接复用 middleware 的 checkLicense（HMAC 签名验证），保持一致
    const authorized = await checkLicense(currentHost)
    return NextResponse.json({ authorized, domains: [], currentHost })
  } catch {
    return NextResponse.json({ authorized: false, domains: [], currentHost, error: 'cannot reach license server' })
  }
}
