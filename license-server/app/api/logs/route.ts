import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ADMIN_KEY = process.env.ADMIN_KEY || ''
const LOG_PATH = process.env.LOG_PATH || join(process.cwd(), 'data', 'logs.json')
const MAX_LOGS = 500

export type LogEntry = { domain: string; time: string; authorized: boolean; ip?: string }

export function readLogs(): LogEntry[] {
  try {
    if (!existsSync(LOG_PATH)) return []
    return JSON.parse(readFileSync(LOG_PATH, 'utf8'))
  } catch { return [] }
}

export function appendLog(entry: LogEntry) {
  try {
    const { mkdirSync } = require('fs')
    const { dirname } = require('path')
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    const logs = readLogs()
    logs.unshift(entry) // 最新的在前
    writeFileSync(LOG_PATH, JSON.stringify(logs.slice(0, MAX_LOGS), null, 2), 'utf8')
  } catch { }
}

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-admin-key')
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(readLogs())
}
