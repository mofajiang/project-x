import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as { licenseKey?: string }))
  const licenseKey = String(body.licenseKey || process.env.MAXMIND_LICENSE_KEY || '').trim()
  if (!licenseKey) {
    return NextResponse.json({ error: 'Missing MaxMind license key' }, { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'node_modules', 'geoip-lite', 'scripts', 'updatedb.js')
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: 'geoip-lite updater not found' }, { status: 500 })
  }

  try {
    execFileSync(process.execPath, [scriptPath, `license_key=${licenseKey}`], {
      cwd: process.cwd(),
      env: { ...process.env, license_key: licenseKey },
      stdio: 'pipe',
    })

    const geoip = require('geoip-lite') as {
      reloadDataSync: () => void
      startWatchingDataUpdate?: () => void
    }
    geoip.reloadDataSync()
    geoip.startWatchingDataUpdate?.()

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}