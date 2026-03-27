import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

const LICENSE_SERVER = process.env.LICENSE_SERVER_URL || 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 获取已授权域名列表（使用 x-admin-key header 服务器间认证）
    const adminKey = process.env.LICENSE_ADMIN_KEY || process.env.ADMIN_KEY || ''
    const res = await fetch(`${LICENSE_SERVER}/api/domains`, {
      headers: { 'x-admin-key': adminKey },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ authorized: false, domains: [], error: 'license server error' })
    }

    const domains: { domain: string; addedAt: string; note?: string }[] = await res.json()
    const domainList = domains.map(d => d.domain)

    // 检查当前站点域名是否在授权列表中
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    let currentHost = ''
    try {
      currentHost = new URL(siteUrl).hostname
    } catch {
      currentHost = siteUrl.replace(/^https?:\/\//, '').split('/')[0]
    }

    const authorized = !!currentHost && domainList.some(
      d => currentHost === d || currentHost.endsWith('.' + d)
    )

    return NextResponse.json({
      authorized,
      domains: domainList,
      currentHost,
    })
  } catch (e) {
    return NextResponse.json({ authorized: false, domains: [], error: 'cannot reach license server' })
  }
}
