import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getStorageStatus } from '@/lib/storage'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getStorageStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
