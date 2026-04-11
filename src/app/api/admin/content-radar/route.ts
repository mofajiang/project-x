import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { ensureKeywordRadarScheduler } from '@/lib/keyword-radar-scheduler'
import { getKeywordRadarStatus, saveKeywordRadarConfig } from '@/lib/keyword-radar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  ensureKeywordRadarScheduler()
  const status = await getKeywordRadarStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  ensureKeywordRadarScheduler()
  const body = await req.json()
  await saveKeywordRadarConfig({
    enabled: Boolean(body.enabled),
    keywords: body.keywords,
    tags: body.tags,
    extraFeeds: body.extraFeeds,
    includeDomains: body.includeDomains,
    excludeDomains: body.excludeDomains,
    scheduleMinutes: Number(body.scheduleMinutes) || 180,
    autoPublish: Boolean(body.autoPublish),
    useAi: Boolean(body.useAi),
    prompt: String(body.prompt || ''),
    maxItems: Number(body.maxItems) || 12,
    keepDays: Number(body.keepDays) || 14,
  })
  const status = await getKeywordRadarStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
