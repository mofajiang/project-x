import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const forwardedHost = req.headers.get('x-forwarded-host') || ''
  const host = req.headers.get('host') || ''
  const forwardedFor = req.headers.get('x-forwarded-for') || ''
  const forwardedProto = req.headers.get('x-forwarded-proto') || ''
  const hostname = (forwardedHost || host).split(':')[0]
  return NextResponse.json({
    hostname,
    'x-forwarded-host': forwardedHost,
    host: host,
    'x-forwarded-for': forwardedFor,
    'x-forwarded-proto': forwardedProto,
  })
}
