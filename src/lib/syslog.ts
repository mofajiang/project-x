/**
 * 结构化系统日志模块
 * 写入 SQLite system_logs 表，跨进程共享，自动限制最大条数
 */
import { prisma } from './prisma'

export type LogLevel = 'info' | 'warn' | 'error'
export type LogCategory = 'ai' | 'comment' | 'post' | 'auth' | 'system' | 'friendlink'

export interface LogEntry {
  id: string
  level: LogLevel
  category: LogCategory
  message: string
  detail: string | null
  createdAt: string
}

const MAX_LOGS = 2000 // 最多保留条数

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'info',
        category TEXT NOT NULL DEFAULT 'system',
        message TEXT NOT NULL DEFAULT '',
        detail TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_syslog_cat ON system_logs (category)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_syslog_time ON system_logs (createdAt DESC)`)
    tableReady = true
  } catch {
    // 表已存在或其他非致命错误，忽略
    tableReady = true
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

async function write(level: LogLevel, category: LogCategory, message: string, detail?: object | string) {
  try {
    await ensureTable()
    const detailStr = detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null
    await prisma.$executeRawUnsafe(
      `INSERT INTO system_logs (id, level, category, message, detail, createdAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      genId(),
      level,
      category,
      message,
      detailStr
    )
    // 异步清理旧日志（不阻塞当前请求）
    pruneOld().catch(() => {})
  } catch {
    // 日志写入失败不应影响业务
  }
}

async function pruneOld() {
  try {
    const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM system_logs`)
    const total = Number((rows[0] as any)?.cnt ?? 0)
    if (total > MAX_LOGS) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM system_logs WHERE id IN (
           SELECT id FROM system_logs ORDER BY createdAt ASC LIMIT ?
         )`,
        total - MAX_LOGS
      )
    }
  } catch {}
}

export const syslog = {
  info: (category: LogCategory, message: string, detail?: object | string) => write('info', category, message, detail),
  warn: (category: LogCategory, message: string, detail?: object | string) => write('warn', category, message, detail),
  error: (category: LogCategory, message: string, detail?: object | string) =>
    write('error', category, message, detail),

  async query(opts: {
    level?: LogLevel
    category?: LogCategory
    limit?: number
    offset?: number
    search?: string
  }): Promise<{ logs: LogEntry[]; total: number }> {
    await ensureTable()
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.level) {
      conditions.push('level = ?')
      params.push(opts.level)
    }
    if (opts.category) {
      conditions.push('category = ?')
      params.push(opts.category)
    }
    if (opts.search) {
      conditions.push('(message LIKE ? OR detail LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = opts.limit ?? 100
    const offset = opts.offset ?? 0

    const [countRows, logRows] = await Promise.all([
      prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM system_logs ${where}`, ...params),
      prisma.$queryRawUnsafe<LogEntry[]>(
        `SELECT id, level, category, message, detail, createdAt
         FROM system_logs ${where}
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      ),
    ])

    return {
      logs: logRows as LogEntry[],
      total: Number((countRows[0] as any)?.cnt ?? 0),
    }
  },

  async clear(category?: LogCategory) {
    await ensureTable()
    if (category) {
      await prisma.$executeRawUnsafe(`DELETE FROM system_logs WHERE category = ?`, category)
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM system_logs`)
    }
  },
}
