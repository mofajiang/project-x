import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { ensureKeywordRadarScheduler } from '@/lib/keyword-radar-scheduler'
import { runKeywordRadar } from '@/lib/keyword-radar'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  ensureKeywordRadarScheduler()
  const result = await runKeywordRadar({ reason: 'manual' })
  return NextResponse.json(result, { status: result.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } })
}
