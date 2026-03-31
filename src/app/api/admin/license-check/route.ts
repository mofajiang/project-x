import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { checkLicense } from '@/lib/license'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 直接从请求头读取真实域名（反向代理已传递 x-forwarded-host）
  const forwarded = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const currentHost = forwarded.split(':')[0]

  const isLocal = currentHost.startsWith('localhost') || currentHost.startsWith('127.') || currentHost.startsWith('192.168.')
  if (isLocal) {
    return NextResponse.json({ authorized: false, currentHost, error: '本地环境无需授权验证' })
  }

  try {
    const authorized = await checkLicense(currentHost)
    return NextResponse.json({ authorized, currentHost })
  } catch {
    return NextResponse.json({ authorized: false, currentHost, error: 'cannot reach license server' })
  }
}
