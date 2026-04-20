import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyJWT, revokeToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
  if (token) {
    const payload = await verifyJWT(token)
    if (payload?.jti && payload.exp) {
      revokeToken(payload.jti, payload.exp * 1000)
    }
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
  return res
}
