import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET_RAW = process.env.JWT_SECRET
if (!JWT_SECRET_RAW) {
  console.error('[auth] ⚠️ JWT_SECRET 环境变量未设置，请配置后重启！使用随机临时密钥，重启后所有会话失效')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || crypto.randomUUID().replace(/-/g, ''))

export interface JWTPayload {
  userId: string
  username: string
  jti?: string
  iat?: number
  exp?: number
}

const revokedTokens = new Map<string, number>()
const REVOKE_CLEANUP_INTERVAL = 60 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  const keys = Array.from(revokedTokens.keys())
  for (const jti of keys) {
    if ((revokedTokens.get(jti) as number) < now) revokedTokens.delete(jti)
  }
}, REVOKE_CLEANUP_INTERVAL)

export function revokeToken(jti: string, expiresAt: number) {
  revokedTokens.set(jti, expiresAt)
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>) {
  const jti = crypto.randomUUID()
  return new SignJWT({ ...payload, jti } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const result = payload as unknown as JWTPayload
    if (result.jti && revokedTokens.has(result.jti)) return null
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

/**
 * Wraps an admin route handler with authentication check.
 * If no valid session is found, returns 401 Unauthorized automatically.
 *
 * Usage:
 *   export const GET = withAuth(async (req, session) => { ... })
 *   export const GET = withAuth(async (req, session, { params }) => { ... })
 */
export function withAuth<TArgs extends unknown[]>(
  handler: (req: NextRequest, session: JWTPayload, ...args: TArgs) => Promise<Response>
) {
  return async (req: NextRequest, ...args: TArgs): Promise<Response> => {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return handler(req, session, ...args)
  }
}
