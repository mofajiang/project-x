import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

if (!process.env.JWT_SECRET) {
  // Fail loudly at startup rather than silently using a known-public secret.
  // Set JWT_SECRET in your environment (see .env.example).
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface JWTPayload {
  userId: string
  username: string
  iat?: number
  exp?: number
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
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
