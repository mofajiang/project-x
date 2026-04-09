'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

type LogLevel = 'info' | 'warn' | 'error'
type LogCategory = 'ai' | 'comment' | 'post' | 'auth' | 'system' | 'friendlink'

interface AppLog {
  id: string
  level: LogLevel
  category: LogCategory
  message: string
  detail: string | null
  createdAt: string
}

const LEVEL_COLORS: Record<LogLevel, { bg: string; text: string; label: string }> = {
  info: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', label: 'INFO' },
  warn: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24', label: 'WARN' },
  error: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'ERROR' },
}

const CATEGORY_LABELS: Record<LogCategory, string> = {
  ai: '🤖 AI 审核',
  comment: '💬 评论',
  post: '📝 文章',
  auth: '🔒 登录',
  system: '⚙️ 系统',
  friendlink: '🔗 友链',
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as LogCategory[]

type TabType = 'app' | 'pm2-out' | 'pm2-err'

export default function AdminLogsPage() {
  const [tab, setTab] = useState<TabType>('app')
  const [logs, setLogs] = useState<AppLog[]>([])
  const [pm2Lines, setPm2Lines] = useState<string[]>([])
  const [pm2Path, setPm2Path] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [filterLevel, setFilterLevel] = useState<LogLevel | ''>('')
  const [filterCategory, setFilterCategory] = useState<LogCategory | ''>('')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [appName, setAppName] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: tab, limit: '200' })
      if (tab === 'app') {
        if (filterLevel) params.set('level', filterLevel)
        if (filterCategory) params.set('category', filterCategory)
        if (search) params.set('search', search)
      } else {
        params.set('limit', '500')
        if (appName) params.set('appName', appName)
      }
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) {
        toast.error('加载日志失败')
        return
      }
      const data = await res.json()
      if (tab === 'app') {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      } else {
        setPm2Lines(data.lines || [])
        setPm2Path(data.path || null)
      }
    } finally {
      setLoading(false)
    }
  }, [tab, filterLevel, filterCategory, search, appName])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchLogs, 5000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoRefresh, fetchLogs])

  const handleClear = async () => {
    if (!confirm('确定要清空所有应用日志吗？')) return
    await fetch(`/api/admin/logs${filterCategory ? `?category=${filterCategory}` : ''}`, { method: 'DELETE' })
    toast.success('日志已清空')
    fetchLogs()
  }

  const toggleDetail = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts + (ts.endsWith('Z') || ts.includes('+') ? '' : 'Z'))
      return d.toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  const pm2LogClass = (line: string) => {
    if (/error|❌|fail|fatal/i.test(line)) return '#f87171'
    if (/warn|⚠️/i.test(line)) return '#fbbf24'
    if (/✅|success|ready/i.test(line)) return '#34d399'
    return 'var(--text-primary)'
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          系统日志
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${autoRefresh ? 'bg-green-500/20 text-green-400' : ''}`}
            style={!autoRefresh ? { background: 'var(--bg-hover)', color: 'var(--text-secondary)' } : {}}
          >
            {autoRefresh ? '🔄 自动刷新中' : '🔄 自动刷新'}
          </button>
          <button
            onClick={fetchLogs}
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            手动刷新
          </button>
          {tab === 'app' && (
            <button
              onClick={handleClear}
              className="rounded-xl px-4 py-2 text-sm font-medium text-red-400"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              清空日志
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['app', 'pm2-out', 'pm2-err'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-accent border-b-2' : ''}`}
            style={{ color: tab === t ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            {t === 'app' ? '📋 应用日志' : t === 'pm2-out' ? '🖥️ PM2 输出' : '⚠️ PM2 错误'}
          </button>
        ))}
      </div>

      {/* App log filters */}
      {tab === 'app' && (
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as LogLevel | '')}
            className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">全部级别</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as LogCategory | '')}
            className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">全部类别</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="搜索日志..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 180 }}
          />

          <span className="py-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            共 {total} 条
          </span>
        </div>
      )}

      {/* PM2 app name input */}
      {(tab === 'pm2-out' || tab === 'pm2-err') && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="PM2 应用名（留空自动探测）"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 220 }}
          />
          {pm2Path && (
            <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
              {pm2Path}
            </span>
          )}
        </div>
      )}

      {/* Log content */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        {loading && logs.length === 0 && pm2Lines.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
            加载中...
          </div>
        ) : tab === 'app' ? (
          logs.length === 0 ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
              暂无日志。应用运行时会自动记录 AI 审核、文章发布等关键事件。
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {logs.map((log) => {
                const lc = LEVEL_COLORS[log.level]
                const expanded = expandedIds.has(log.id)
                return (
                  <div
                    key={log.id}
                    className="px-4 py-3 transition-opacity hover:opacity-90"
                    style={{ background: expanded ? lc.bg : 'transparent' }}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                        style={{ background: lc.bg, color: lc.text }}
                      >
                        {lc.label}
                      </span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                      >
                        {CATEGORY_LABELS[log.category]}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {log.message}
                      </span>
                      <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(log.createdAt)}
                      </span>
                      {log.detail && (
                        <button
                          onClick={() => toggleDetail(log.id)}
                          className="shrink-0 text-[11px] underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {expanded ? '收起' : '详情'}
                        </button>
                      )}
                    </div>
                    {expanded && log.detail && (
                      <pre
                        className="mt-2 overflow-x-auto rounded p-3 font-mono text-xs"
                        style={{
                          background: 'var(--bg)',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(log.detail), null, 2)
                          } catch {
                            return log.detail
                          }
                        })()}
                      </pre>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : // PM2 raw logs
        pm2Lines.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
            {pm2Path === null
              ? '未找到 PM2 日志文件。请输入 PM2 应用名，或设置 PM2_LOG_DIR 环境变量。'
              : '日志文件为空'}
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-0.5 font-mono text-xs">
              {pm2Lines.map((line, i) => (
                <div key={i} className="break-all py-0.5" style={{ color: pm2LogClass(line) }}>
                  {line}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
