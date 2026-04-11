import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getRadarStats } from '@/lib/keyword-radar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stats = await getRadarStats()
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } })
}
