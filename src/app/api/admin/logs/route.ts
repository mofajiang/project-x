import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { syslog, type LogLevel, type LogCategory } from '@/lib/syslog'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'

/** 探测 PM2 日志文件路径 */
function detectPm2LogPaths(appName?: string): { out: string | null; err: string | null } {
  const names = appName ? [appName] : ['x-blog', 'blog', 'nextjs-blog', 'app', 'server', 'project-x']

  const pm2LogDir = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs')

  for (const name of names) {
    const out = path.join(pm2LogDir, `${name}-out.log`)
    const err = path.join(pm2LogDir, `${name}-error.log`)
    if (existsSync(out) || existsSync(err)) {
      return {
        out: existsSync(out) ? out : null,
        err: existsSync(err) ? err : null,
      }
    }
  }
  return { out: null, err: null }
}

/** 读取文件末尾 N 行 */
async function tailFile(filePath: string, lines = 200): Promise<string[]> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const all = content.split('\n').filter(Boolean)
    return all.slice(-lines)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'app' // app | pm2-out | pm2-err
  const level = searchParams.get('level') as LogLevel | null
  const category = searchParams.get('category') as LogCategory | null
  const search = searchParams.get('search') || ''
  const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') || '100')))
  const offset = parseInt(searchParams.get('offset') || '0')
  const appName = searchParams.get('appName') || undefined

  if (type === 'app') {
    const result = await syslog.query({
      level: level || undefined,
      category: category || undefined,
      limit,
      offset,
      search: search || undefined,
    })
    return NextResponse.json(result)
  }

  // PM2 日志
  const paths = detectPm2LogPaths(appName)
  const filePath = type === 'pm2-err' ? paths.err : paths.out

  if (!filePath) {
    return NextResponse.json({
      lines: [],
      path: null,
      message: 'PM2 日志文件未找到。请确认 PM2 日志目录或设置环境变量 PM2_LOG_DIR。',
    })
  }

  const lines = await tailFile(filePath, limit)
  return NextResponse.json({ lines, path: filePath, total: lines.length })
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') as LogCategory | null

  await syslog.clear(category || undefined)
  return NextResponse.json({ ok: true })
}
