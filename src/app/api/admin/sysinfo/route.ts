import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import os from 'os'
import process from 'process'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mem = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const uptimeSec = Math.floor(process.uptime())

  const hours = Math.floor(uptimeSec / 3600)
  const minutes = Math.floor((uptimeSec % 3600) / 60)
  const seconds = uptimeSec % 60
  const uptimeStr = hours > 0
    ? `${hours}h ${minutes}m`
    : minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`

  return NextResponse.json({
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model?.split(' ').slice(0, 3).join(' ') || 'Unknown',
    totalMemMB: Math.round(totalMem / 1024 / 1024),
    freeMemMB: Math.round(freeMem / 1024 / 1024),
    usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
    memPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    uptimeStr,
    uptimeSec,
    osUptime: Math.floor(os.uptime() / 3600) + 'h',
    loadAvg: os.loadavg().map(n => n.toFixed(2)),
  })
}
