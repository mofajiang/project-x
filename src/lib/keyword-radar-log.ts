import { prisma } from '@/lib/prisma'

export type KeywordRadarLogLevel = 'info' | 'success' | 'error'

export type KeywordRadarLogEntry = {
  id: string
  runId: string
  source: 'manual' | 'scheduler'
  level: KeywordRadarLogLevel
  message: string
  createdAt: string
}

export type KeywordRadarLogState = {
  activeRunId: string
  running: boolean
  source: 'manual' | 'scheduler' | ''
  startedAt: string
  finishedAt: string
  entries: KeywordRadarLogEntry[]
}

const MAX_LIVE_ENTRIES = 200
const MAX_DB_ROWS = 2000
const DB_KEEP_DAYS = 7

declare global {
  var __keywordRadarLogState: KeywordRadarLogState | undefined
}

function getInitialState(): KeywordRadarLogState {
  return {
    activeRunId: '',
    running: false,
    source: '',
    startedAt: '',
    finishedAt: '',
    entries: [],
  }
}

function getStore() {
  if (!globalThis.__keywordRadarLogState) {
    globalThis.__keywordRadarLogState = getInitialState()
  }
  return globalThis.__keywordRadarLogState
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function startKeywordRadarLog(source: 'manual' | 'scheduler') {
  const store = getStore()
  const runId = makeId()
  store.activeRunId = runId
  store.running = true
  store.source = source
  store.startedAt = new Date().toISOString()
  store.finishedAt = ''
  store.entries = []
  return runId
}

export function appendKeywordRadarLog(
  runId: string,
  level: KeywordRadarLogLevel,
  message: string,
  source: 'manual' | 'scheduler'
) {
  const store = getStore()
  if (store.activeRunId !== runId) return
  const entry: KeywordRadarLogEntry = {
    id: makeId(),
    runId,
    source,
    level,
    message,
    createdAt: new Date().toISOString(),
  }
  store.entries.push(entry)
  if (store.entries.length > MAX_LIVE_ENTRIES) {
    store.entries.splice(0, store.entries.length - MAX_LIVE_ENTRIES)
  }
  // 异步持久化，不阻塞主流程
  persistLogEntry(entry).catch(() => {})
}

export function finishKeywordRadarLog(runId: string) {
  const store = getStore()
  if (store.activeRunId !== runId) return
  store.running = false
  store.finishedAt = new Date().toISOString()
}

export function getKeywordRadarLogState(): KeywordRadarLogState {
  const store = getStore()
  return {
    activeRunId: store.activeRunId,
    running: store.running,
    source: store.source,
    startedAt: store.startedAt,
    finishedAt: store.finishedAt,
    entries: [...store.entries],
  }
}

// ─── 持久化部分 ───

async function persistLogEntry(entry: KeywordRadarLogEntry) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO KeywordRadarLog (id, runId, source, level, message, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.runId,
      entry.source,
      entry.level,
      entry.message,
      entry.createdAt
    )
  } catch {}
}

export async function getKeywordRadarLogHistory(options?: {
  runId?: string
  limit?: number
  beforeId?: string
}): Promise<KeywordRadarLogEntry[]> {
  const limit = Math.min(options?.limit || 100, 500)
  const conditions: string[] = []
  const params: unknown[] = []
  if (options?.runId) {
    conditions.push('runId = ?')
    params.push(options.runId)
  }
  if (options?.beforeId) {
    conditions.push('createdAt < (SELECT createdAt FROM KeywordRadarLog WHERE id = ?)')
    params.push(options.beforeId)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, runId, source, level, message, createdAt
     FROM KeywordRadarLog ${where}
     ORDER BY createdAt DESC
     LIMIT ?`,
    ...params,
    limit
  )
  return rows
    .map((r) => ({
      id: String(r.id || ''),
      runId: String(r.runId || ''),
      source: String(r.source || 'manual') as 'manual' | 'scheduler',
      level: String(r.level || 'info') as KeywordRadarLogLevel,
      message: String(r.message || ''),
      createdAt: String(r.createdAt || ''),
    }))
    .reverse()
}

export async function getKeywordRadarRunList(
  limit = 20
): Promise<Array<{ runId: string; source: string; startedAt: string; entryCount: number }>> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT runId, source, MIN(createdAt) as startedAt, COUNT(*) as entryCount
     FROM KeywordRadarLog
     GROUP BY runId
     ORDER BY startedAt DESC
     LIMIT ?`,
    limit
  )
  return rows.map((r) => ({
    runId: String(r.runId || ''),
    source: String(r.source || ''),
    startedAt: String(r.startedAt || ''),
    entryCount: Number(r.entryCount || 0),
  }))
}

export async function pruneKeywordRadarLogs() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM KeywordRadarLog WHERE createdAt < datetime('now', '-' || ? || ' day')`,
    DB_KEEP_DAYS
  )
  const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM KeywordRadarLog`)
  const total = Number(rows[0]?.cnt || 0)
  if (total > MAX_DB_ROWS) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM KeywordRadarLog WHERE id IN (
         SELECT id FROM KeywordRadarLog ORDER BY createdAt ASC LIMIT ?
       )`,
      total - MAX_DB_ROWS
    )
  }
}
