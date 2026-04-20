import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface JWTPayload {
  userId: string
  username: string
  jti?: string
  iat?: number
  exp?: number
}

const revokedTokens = new Map<string, number>()
const lastCleanup = { t: 0 }
const REVOKE_CLEANUP_INTERVAL = 60 * 60 * 1000

export function revokeToken(jti: string, expiresAt: number) {
  const now = Date.now()
  if (!lastCleanup.t || now - lastCleanup.t > REVOKE_CLEANUP_INTERVAL) {
    revokedTokens.forEach((val, key) => {
      if (val < now) revokedTokens.delete(key)
    })
    lastCleanup.t = now
  }
  revokedTokens.set(jti, expiresAt)
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const result = payload as unknown as JWTPayload
    if (!result.jti || revokedTokens.has(result.jti)) return null
    return result
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyJWT(token)
}

export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return null
  return verifyJWT(token)
}

export function withAuth<TArgs extends unknown[]>(
  handler: (req: NextRequest, session: JWTPayload, ...args: TArgs) => Promise<Response>
) {
  return async (req: NextRequest, ...args: TArgs): Promise<Response> => {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return handler(req, session, ...args)
  }
}
