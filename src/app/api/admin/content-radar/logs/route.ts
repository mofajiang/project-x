import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getKeywordRadarLogHistory, getKeywordRadarRunList } from '@/lib/keyword-radar-log'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId') || undefined
  const beforeId = searchParams.get('beforeId') || undefined
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500)
  const listRuns = searchParams.get('listRuns')

  if (listRuns === '1') {
    const runs = await getKeywordRadarRunList(30)
    return NextResponse.json({ runs }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const entries = await getKeywordRadarLogHistory({ runId, limit, beforeId })
  return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } })
}
