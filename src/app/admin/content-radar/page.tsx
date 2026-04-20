'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { IMEInput } from '@/components/ui/IMEInput'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import { formatTime, formatTimeShort } from '@/lib/utils'
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_CARD_CLASS,
  ADMIN_INPUT_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_SUBCARD_CLASS,
} from '@/components/admin/adminUi'

type RadarConfig = {
  enabled: boolean
  keywords: string[]
  tags: string[]
  extraFeeds: string[]
  includeDomains: string[]
  excludeDomains: string[]
  scheduleMinutes: number
  autoPublish: boolean
  useAi: boolean
  standardMarkdown: boolean
  prompt: string
  lastRunAt: string
  lastStatus: string
  lastMessage: string
  lastPostId: string
  maxItems: number
  keepDays: number
  maxArticleAgeDays: number
  sources: string[]
  customSourceTemplates: Array<{ name: string; urlTemplate: string }>
  webhookUrl: string
  webhookEnabled: boolean
  useShortLinks: boolean
}

type RadarItem = {
  hash: string
  digestDate: string
  keywords: string[]
  title: string
  link: string
  summary: string
  source: string
  itemPublishedAt: string
  postId: string
  createdAt: string
}

type RadarStatus = {
  config: RadarConfig
  recentItems: RadarItem[]
  totalSeen: number
  logs: {
    activeRunId: string
    running: boolean
    source: 'manual' | 'scheduler' | ''
    startedAt: string
    finishedAt: string
    entries: Array<{
      id: string
      runId: string
      source: 'manual' | 'scheduler'
      level: 'info' | 'success' | 'error'
      message: string
      createdAt: string
    }>
  }
}

const EMPTY_STATUS: RadarStatus = {
  config: {
    enabled: false,
    keywords: [],
    tags: ['日报'],
    extraFeeds: [],
    includeDomains: [],
    excludeDomains: [],
    scheduleMinutes: 180,
    autoPublish: true,
    useAi: true,
    standardMarkdown: true,
    prompt: '',
    lastRunAt: '',
    lastStatus: '',
    lastMessage: '',
    lastPostId: '',
    maxItems: 12,
    keepDays: 14,
    maxArticleAgeDays: 7,
    sources: ['google'],
    customSourceTemplates: [],
    webhookUrl: '',
    webhookEnabled: false,
    useShortLinks: false,
  },
  recentItems: [],
  totalSeen: 0,
  logs: {
    activeRunId: '',
    running: false,
    source: '',
    startedAt: '',
    finishedAt: '',
    entries: [],
  },
}

function textToList(value: string) {
  return value
    .split(/[\n\r\t,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AdminContentRadarPage() {
  const [status, setStatus] = useState<RadarStatus>(EMPTY_STATUS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [running, setRunning] = useState(false)
  const coolingDownUntilRef = useRef(0)
  const [keywordsInput, setKeywordsInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [feedsInput, setFeedsInput] = useState('')
  const [includeDomainsInput, setIncludeDomainsInput] = useState('')
  const [excludeDomainsInput, setExcludeDomainsInput] = useState('')
  const logContainerRef = useRef<HTMLDivElement | null>(null)
  const [logTab, setLogTab] = useState<'live' | 'history'>('live')
  const [historyRuns, setHistoryRuns] = useState<
    Array<{ runId: string; source: string; startedAt: string; entryCount: number }>
  >([])
  const [historyEntries, setHistoryEntries] = useState<RadarStatus['logs']['entries']>([])
  const [historyRunId, setHistoryRunId] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewResult, setPreviewResult] = useState<{
    content: string
    message: string
    matchedCount: number
    newCount: number
    digestDate: string
  } | null>(null)
  const [healthData, setHealthData] = useState<
    Array<{
      sourceId: string
      label: string
      total: number
      successCount: number
      failCount: number
      successRate: number
      avgLatencyMs: number
      lastError: string
      degraded: boolean
    }>
  >([])
  const [statsData, setStatsData] = useState<{
    dailyTrend: Array<{ date: string; count: number }>
    keywordFrequency: Array<{ keyword: string; count: number }>
    sourceDistribution: Array<{ source: string; count: number }>
    totalItems: number
    totalDays: number
  } | null>(null)
  const [dashTab, setDashTab] = useState<'config' | 'health' | 'stats' | 'history'>('config')
  const [historyDigests, setHistoryDigests] = useState<
    Array<{ id: string; title: string; publishedAt: string; digestDate: string; itemCount: number }>
  >([])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/admin/content-radar/history')
      const data = await res.json()
      if (res.ok && data.digests) setHistoryDigests(data.digests)
    } catch {}
  }

  useEffect(() => {
    fetchStatus({ syncForm: true })
  }, [])

  useEffect(() => {
    if (running) {
      coolingDownUntilRef.current = Date.now() + 5000
    }
  }, [running])

  useEffect(() => {
    fetchStatus({ syncForm: false, silent: true }).catch(() => {})
    const intervalMs = status.logs.running || running ? 1200 : Date.now() < coolingDownUntilRef.current ? 1200 : 15000
    const timer = window.setInterval(() => {
      fetchStatus({ syncForm: false, silent: true })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [running, status.logs.running])

  useEffect(() => {
    const node = logContainerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [status.logs.entries])

  const fetchStatus = async ({ syncForm = false, silent = false }: { syncForm?: boolean; silent?: boolean } = {}) => {
    // Skip polling updates while saving to prevent overwriting unsaved form state
    if (savingRef.current && !syncForm) return
    try {
      const res = await fetch('/api/admin/content-radar', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      if (syncForm) {
        setStatus(data)
        setKeywordsInput((data.config.keywords || []).join('\n'))
        setTagsInput((data.config.tags || []).join(', '))
        setFeedsInput((data.config.extraFeeds || []).join('\n'))
        setIncludeDomainsInput((data.config.includeDomains || []).join('\n'))
        setExcludeDomainsInput((data.config.excludeDomains || []).join('\n'))
      } else {
        // Only update non-config status (logs, recentItems) during polling to avoid overwriting user edits
        setStatus((current) => ({
          ...current,
          recentItems: data.recentItems,
          totalSeen: data.totalSeen,
          logs: data.logs,
        }))
      }
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : '加载失败')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const setConfig = <K extends keyof RadarConfig>(key: K, value: RadarConfig[K]) => {
    setStatus((current) => ({ ...current, config: { ...current.config, [key]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    savingRef.current = true
    try {
      const res = await fetch('/api/admin/content-radar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...status.config,
          keywords: textToList(keywordsInput),
          tags: textToList(tagsInput),
          extraFeeds: textToList(feedsInput),
          includeDomains: textToList(includeDomainsInput),
          excludeDomains: textToList(excludeDomainsInput),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setStatus(data)
      setKeywordsInput((data.config.keywords || []).join('\n'))
      setTagsInput((data.config.tags || []).join(', '))
      setFeedsInput((data.config.extraFeeds || []).join('\n'))
      setIncludeDomainsInput((data.config.includeDomains || []).join('\n'))
      setExcludeDomainsInput((data.config.excludeDomains || []).join('\n'))
      toast.success('内容雷达配置已保存')
      savingRef.current = false
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setLogTab('live')
    try {
      fetchStatus({ syncForm: false, silent: true }).catch(() => {})
      const res = await fetch('/api/admin/content-radar/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || '执行失败')
      toast.success(data.message || '执行完成')
      await fetchStatus({ syncForm: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '执行失败')
    } finally {
      setRunning(false)
    }
  }

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      const res = await fetch('/api/admin/content-radar/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewOnly: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || '预览失败')
      setPreviewResult({
        content: data.content || '',
        message: data.message || '',
        matchedCount: Number(data.matchedCount || 0),
        newCount: Number(data.newCount || 0),
        digestDate: String(data.digestDate || ''),
      })
      toast.success(data.message || '预览已生成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '预览失败')
    } finally {
      setPreviewing(false)
    }
  }

  const loadHistoryRuns = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/content-radar/logs?listRuns=1', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.runs) setHistoryRuns(data.runs)
    } catch {
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadHistoryEntries = async (runId: string) => {
    setHistoryRunId(runId)
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/admin/content-radar/logs?runId=${encodeURIComponent(runId)}&limit=500`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (res.ok && data.entries) setHistoryEntries(data.entries)
    } catch {
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/content-radar/health', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.sources) setHealthData(data.sources)
    } catch {}
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/content-radar/stats', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setStatsData(data)
    } catch {}
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>加载中...</div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>
            内容雷达
          </h1>
          <p className="max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            只填关键词即可自动从 Google News RSS
            搜索抓取相关内容，汇总为当天一篇日报文章。默认只保存去重指纹和摘要，尽量减少服务器存储占用。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing}
            className={ADMIN_BTN_SECONDARY}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            {previewing ? '预览生成中...' : '仅预览文案'}
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className={ADMIN_BTN_SECONDARY}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            {running ? '执行中...' : '立即抓取'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={ADMIN_BTN_PRIMARY}
            style={{ background: 'var(--accent)' }}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  抓取规则
                </h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  关键词会自动转成新闻搜索 RSS。额外 RSS 源是可选项，用于补充行业站点。
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={status.config.enabled}
                  onChange={(e) => setConfig('enabled', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                启用定时抓取
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  关键词
                </label>
                <textarea
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  rows={6}
                  className={`${ADMIN_INPUT_CLASS} min-h-[140px] resize-y`}
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                  placeholder="逗号或换行分隔，例如：AI 编程, 大模型, RAG"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  自动打标签
                </label>
                <IMEInput
                  type="text"
                  value={tagsInput}
                  onValueChange={setTagsInput}
                  className={ADMIN_INPUT_CLASS}
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                  placeholder="例如：日报, AI, 资讯"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  额外 RSS 源（可选）
                </label>
                <textarea
                  value={feedsInput}
                  onChange={(e) => setFeedsInput(e.target.value)}
                  rows={4}
                  className={`${ADMIN_INPUT_CLASS} min-h-[100px] resize-y`}
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                  placeholder="逗号或换行分隔，例如：https://a.com/feed.xml, https://b.com/rss"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    仅保留这些域名（可选）
                  </label>
                  <textarea
                    value={includeDomainsInput}
                    onChange={(e) => setIncludeDomainsInput(e.target.value)}
                    rows={4}
                    className={`${ADMIN_INPUT_CLASS} min-h-[96px] resize-y`}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                    placeholder="逗号或换行分隔，例如：36kr.com, infoq.cn"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    排除这些域名（可选）
                  </label>
                  <textarea
                    value={excludeDomainsInput}
                    onChange={(e) => setExcludeDomainsInput(e.target.value)}
                    rows={4}
                    className={`${ADMIN_INPUT_CLASS} min-h-[96px] resize-y`}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                    placeholder="逗号或换行分隔，例如：spam-site.example"
                  />
                </div>
              </div>
            </div>
          </section>

          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              发帖与存储策略
            </h2>

            {/* 调度与容量 */}
            <div className="mb-5">
              <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                调度与容量
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    定时周期（分钟）
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={status.config.scheduleMinutes}
                    onChange={(e) => setConfig('scheduleMinutes', Number(e.target.value) || 180)}
                    className={ADMIN_INPUT_CLASS}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    调度器会常驻检查，到点才真正执行。
                  </p>
                </div>

                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    每篇日报最多收录条数
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={status.config.maxItems}
                    onChange={(e) => setConfig('maxItems', Number(e.target.value) || 12)}
                    className={ADMIN_INPUT_CLASS}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    控制生成文章长度，也减少 AI 上下文成本。
                  </p>
                </div>

                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    去重记录保留天数
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={status.config.keepDays}
                    onChange={(e) => setConfig('keepDays', Number(e.target.value) || 14)}
                    className={ADMIN_INPUT_CLASS}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    这里只保留标题、链接、摘要与指纹，超过时会自动清理旧记录。
                  </p>
                </div>

                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    文章时效过滤（天）
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={status.config.maxArticleAgeDays}
                    onChange={(e) => setConfig('maxArticleAgeDays', Number(e.target.value) || 7)}
                    className={ADMIN_INPUT_CLASS}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    只收录多少天内发布的文章，过滤旧内容，提升日报时效性。
                  </p>
                </div>
              </div>
            </div>

            {/* 抓取源 */}
            <div className="mb-5">
              <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                抓取源
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    抓取源
                  </label>
                  <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div>
                      <p className="mb-1.5 text-xs font-medium opacity-60">新闻搜索</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { id: 'google', label: 'Google News', hint: '国际，需科学上网' },
                          { id: 'bing', label: 'Bing News', hint: '国内可用' },
                          { id: 'baidu', label: '百度新闻', hint: '国内中文' },
                          { id: 'yahoo', label: 'Yahoo News', hint: '国际英文' },
                        ].map((src) => (
                          <label key={src.id} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={(status.config.sources || []).includes(src.id)}
                              onChange={(e) => {
                                const cur = status.config.sources || ['google']
                                const next = e.target.checked
                                  ? [...cur.filter((s: string) => s !== src.id), src.id]
                                  : cur.filter((s: string) => s !== src.id)
                                setConfig('sources', next.length ? next : ['google'])
                              }}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span>{src.label}</span>
                            <span className="text-[10px] opacity-50">{src.hint}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium opacity-60">博客 / 社区</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { id: 'hackernews', label: 'Hacker News', hint: '技术' },
                          { id: 'reddit', label: 'Reddit', hint: '社区' },
                          { id: 'devto', label: 'DEV.to', hint: '开发者' },
                          { id: 'medium', label: 'Medium', hint: '博客' },
                          { id: 'zhihu', label: '知乎', hint: '中文' },
                          { id: 'v2ex', label: 'V2EX', hint: '中文技术' },
                          { id: 'lobsters', label: 'Lobsters', hint: '技术' },
                          { id: 'juejin', label: '掘金', hint: '中文开发者' },
                          { id: 'csdn', label: 'CSDN', hint: '中文技术博客' },
                          { id: 'github', label: 'GitHub', hint: '开源项目' },
                          { id: 'oschina', label: '开源中国', hint: '中文技术' },
                          { id: '36kr', label: '36氪', hint: '中文科技' },
                        ].map((src) => (
                          <label key={src.id} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={(status.config.sources || []).includes(src.id)}
                              onChange={(e) => {
                                const cur = status.config.sources || ['google']
                                const next = e.target.checked
                                  ? [...cur.filter((s: string) => s !== src.id), src.id]
                                  : cur.filter((s: string) => s !== src.id)
                                setConfig('sources', next.length ? next : ['google'])
                              }}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span>{src.label}</span>
                            <span className="text-[10px] opacity-50">{src.hint}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium opacity-60">HTML 解析（备用）</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { id: 'sogou', label: '搜狗资讯', hint: '中文' },
                          { id: 'wechat', label: '微信公众号', hint: '中文' },
                          { id: 'duckduckgo', label: 'DuckDuckGo', hint: '隐私' },
                          { id: 'yandex', label: 'Yandex', hint: '俄/国际' },
                        ].map((src) => (
                          <label key={src.id} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={(status.config.sources || []).includes(src.id)}
                              onChange={(e) => {
                                const cur = status.config.sources || ['google']
                                const next = e.target.checked
                                  ? [...cur.filter((s: string) => s !== src.id), src.id]
                                  : cur.filter((s: string) => s !== src.id)
                                setConfig('sources', next.length ? next : ['google'])
                              }}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span>{src.label}</span>
                            <span className="text-[10px] opacity-50">{src.hint}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    自定义 RSS 搜索模板
                  </label>
                  <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    URL 中用 <code>{'{keyword}'}</code> 作为关键词占位符，抓取时会自动替换。
                  </p>
                  {(status.config.customSourceTemplates || []).map((tmpl, idx) => (
                    <div key={idx} className="mb-2 flex items-center gap-2">
                      <input
                        placeholder="名称"
                        value={tmpl.name}
                        onChange={(e) => {
                          const list = [...(status.config.customSourceTemplates || [])]
                          list[idx] = { ...list[idx], name: e.target.value }
                          setConfig('customSourceTemplates', list)
                        }}
                        className={ADMIN_INPUT_CLASS}
                        style={{
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          width: '120px',
                        }}
                      />
                      <input
                        placeholder="https://example.com/rss?q={keyword}"
                        value={tmpl.urlTemplate}
                        onChange={(e) => {
                          const list = [...(status.config.customSourceTemplates || [])]
                          list[idx] = { ...list[idx], urlTemplate: e.target.value }
                          setConfig('customSourceTemplates', list)
                        }}
                        className={ADMIN_INPUT_CLASS}
                        style={{
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          flex: 1,
                        }}
                      />
                      <button
                        onClick={() => {
                          const list = (status.config.customSourceTemplates || []).filter(
                            (_: unknown, i: number) => i !== idx
                          )
                          setConfig('customSourceTemplates', list)
                        }}
                        className="rounded px-2 py-1 text-xs"
                        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const list = [...(status.config.customSourceTemplates || []), { name: '', urlTemplate: '' }]
                      setConfig('customSourceTemplates', list)
                    }}
                    className="rounded px-3 py-1 text-xs"
                    style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
                  >
                    + 添加模板
                  </button>
                </div>
              </div>
            </div>

            {/* 发布选项 */}
            <div className="mb-5">
              <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                发布选项
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={status.config.autoPublish}
                        onChange={(e) => setConfig('autoPublish', e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      自动发布日报文章
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={status.config.useAi}
                        onChange={(e) => setConfig('useAi', e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      使用 AI 生成日报文案
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={status.config.standardMarkdown}
                        onChange={(e) => setConfig('standardMarkdown', e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      按标准 Markdown 输出
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={status.config.useShortLinks}
                        onChange={(e) => setConfig('useShortLinks', e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      使用短链接跳转
                    </label>
                  </div>
                  <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    开启后会优先输出标准 Markdown 标题、列表和 Markdown
                    链接，减少裸链接或长段文本把内容区域撑出边框的问题。开启短链接后，日报中的原文链接将通过本站 /go/xxx
                    跳转，缩短显示长度。
                  </p>
                </div>
                <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Webhook 通知
                  </label>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={status.config.webhookEnabled}
                        onChange={(e) => setConfig('webhookEnabled', e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      启用 Webhook
                    </label>
                    <input
                      type="url"
                      value={status.config.webhookUrl}
                      onChange={(e) => setConfig('webhookUrl', e.target.value)}
                      className={ADMIN_INPUT_CLASS}
                      style={{
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                      }}
                      placeholder="https://hooks.example.com/webhook"
                    />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      每次抓取完成后会向此 URL 发送 POST JSON 通知（包含状态和统计）。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                AI 额外提示词（可选）
              </label>
              <textarea
                value={status.config.prompt}
                onChange={(e) => setConfig('prompt', e.target.value)}
                rows={4}
                className={`${ADMIN_INPUT_CLASS} min-h-[96px] resize-y`}
                style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                placeholder="例如：更偏技术情报风格，少一些空泛总结，多一些要点提炼。"
              />
            </div>

            {previewResult && (
              <div
                className="mt-6 rounded-3xl border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                      文案预览
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {previewResult.message} · 命中 {previewResult.matchedCount} 条 · 新增 {previewResult.newCount} 条
                      · 日期 {previewResult.digestDate}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewResult(null)}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    关闭预览
                  </button>
                </div>
                <div
                  className="max-h-[480px] overflow-y-auto rounded-2xl border px-4 py-4"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <MarkdownRenderer content={previewResult.content} />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLogTab('live')}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: logTab === 'live' ? 'var(--accent)' : 'transparent',
                    color: logTab === 'live' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  实时日志
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogTab('history')
                    loadHistoryRuns()
                  }}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: logTab === 'history' ? 'var(--accent)' : 'transparent',
                    color: logTab === 'history' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  历史记录
                </button>
              </div>
              {logTab === 'live' && (
                <span
                  className="rounded-full px-2 py-1 text-xs"
                  style={{
                    background: status.logs.running ? 'rgba(29,155,240,0.12)' : 'rgba(0,186,124,0.14)',
                    color: status.logs.running ? 'var(--accent)' : 'var(--green)',
                  }}
                >
                  {status.logs.running ? `${status.logs.source === 'manual' ? '手动任务' : '定时任务'}执行中` : '空闲'}
                </span>
              )}
            </div>
            {logTab === 'live' && (
              <div
                ref={logContainerRef}
                className="max-h-[360px] overflow-y-auto rounded-2xl border px-3 py-3 font-mono text-xs leading-6"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-primary)',
                }}
              >
                {status.logs.entries.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)' }}>暂无抓取日志，点击“立即抓取”后会在这里实时显示。</p>
                )}
                <div className="space-y-2">
                  {status.logs.entries.map((entry) => (
                    <div key={entry.id} className="break-words">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(entry.createdAt, { timeZone: 'Asia/Shanghai' })}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}> · </span>
                      <span
                        style={{
                          color:
                            entry.level === 'success'
                              ? 'var(--green)'
                              : entry.level === 'error'
                                ? 'var(--red)'
                                : 'var(--accent)',
                        }}
                      >
                        {entry.level.toUpperCase()}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}> · </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {entry.source === 'manual' ? '手动' : '定时'}
                      </span>
                      <div>{entry.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {logTab === 'history' && (
              <div
                className="max-h-[360px] overflow-y-auto rounded-2xl border px-3 py-3 text-xs leading-6"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-primary)',
                }}
              >
                {historyLoading && <p style={{ color: 'var(--text-secondary)' }}>加载中...</p>}

                {!historyLoading && !historyRunId && (
                  <div className="space-y-2">
                    {historyRuns.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>暂无历史运行记录。</p>}
                    {historyRuns.map((run) => (
                      <button
                        key={run.runId}
                        type="button"
                        onClick={() => loadHistoryEntries(run.runId)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:opacity-80"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {formatTimeShort(run.startedAt, { timeZone: 'Asia/Shanghai' })}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}> · </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {run.source === 'manual' ? '手动' : '定时'}
                          </span>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
                        >
                          {run.entryCount} 条
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {!historyLoading && historyRunId && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryRunId(null)
                        setHistoryEntries([])
                      }}
                      className="mb-3 text-xs hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      ← 返回运行列表
                    </button>
                    <div className="space-y-2 font-mono">
                      {historyEntries.map((entry) => (
                        <div key={entry.id} className="break-words">
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {formatTime(entry.createdAt, { timeZone: 'Asia/Shanghai' })}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}> · </span>
                          <span
                            style={{
                              color:
                                entry.level === 'success'
                                  ? 'var(--green)'
                                  : entry.level === 'error'
                                    ? 'var(--red)'
                                    : 'var(--accent)',
                            }}
                          >
                            {entry.level.toUpperCase()}
                          </span>
                          <div>{entry.message}</div>
                        </div>
                      ))}
                      {historyEntries.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)' }}>该次运行暂无日志。</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              当前状态
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: 'var(--text-secondary)' }}>运行状态</span>
                <span
                  className="rounded-full px-2 py-1 text-xs"
                  style={{
                    background:
                      status.config.lastStatus === 'success'
                        ? 'rgba(0,186,124,0.14)'
                        : status.config.lastStatus === 'failed'
                          ? 'rgba(249,24,128,0.14)'
                          : 'rgba(29,155,240,0.12)',
                    color:
                      status.config.lastStatus === 'success'
                        ? 'var(--green)'
                        : status.config.lastStatus === 'failed'
                          ? 'var(--red)'
                          : 'var(--accent)',
                  }}
                >
                  {status.config.lastStatus || '尚未执行'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: 'var(--text-secondary)' }}>最近执行</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {formatTime(status.config.lastRunAt, { timeZone: 'Asia/Shanghai' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: 'var(--text-secondary)' }}>去重记录</span>
                <span style={{ color: 'var(--text-primary)' }}>{status.totalSeen}</span>
              </div>
              <div>
                <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>
                  最近消息
                </p>
                <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                  {status.config.lastMessage || '暂无'}
                </p>
              </div>
              {status.config.lastPostId && (
                <div>
                  <Link
                    href={`/admin/posts/${status.config.lastPostId}`}
                    className="text-sm hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    查看最近生成的日报 →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              最近命中内容
            </h2>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {status.recentItems.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  还没有抓取记录。
                </p>
              )}
              {status.recentItems.map((item) => (
                <div
                  key={item.hash}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="mb-1 flex items-center gap-1.5 text-[10px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="rounded px-1.5 py-0.5" style={{ background: 'rgba(29,155,240,0.08)' }}>
                      {item.source || '未知'}
                    </span>
                    <span>{item.digestDate.replace(/-/g, '.')}</span>
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-[13px] font-medium leading-5 hover:underline"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.title}
                  </a>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-xs leading-4" style={{ color: 'var(--text-secondary)' }}>
                      {item.summary}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* 源健康 & 统计面板 */}
      <div className="mt-6 space-y-6">
        <div className="flex gap-2">
          {(['health', 'stats', 'history'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setDashTab(tab)
                if (tab === 'health') fetchHealth()
                if (tab === 'stats') fetchStats()
                if (tab === 'history') fetchHistory()
              }}
              className="rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: dashTab === tab ? 'var(--accent)' : 'transparent',
                color: dashTab === tab ? '#fff' : 'var(--text-secondary)',
                border: dashTab === tab ? 'none' : '1px solid var(--border)',
              }}
            >
              {tab === 'health' ? '源健康状态' : tab === 'stats' ? '数据统计' : '历史日报'}
            </button>
          ))}
        </div>

        {dashTab === 'health' && (
          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                抓取源健康状态
              </h2>
              <button
                type="button"
                onClick={fetchHealth}
                className="rounded px-3 py-1 text-xs"
                style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
              >
                刷新
              </button>
            </div>
            {healthData.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                暂无健康数据，运行一次抓取后即可看到。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }} className="border-b">
                      <th className="px-3 py-2 font-medium">来源</th>
                      <th className="px-3 py-2 font-medium">成功率</th>
                      <th className="px-3 py-2 font-medium">延迟</th>
                      <th className="px-3 py-2 font-medium">总计</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">最近错误</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthData.map((src) => (
                      <tr key={src.sourceId} className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {src.label || src.sourceId}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: '60px',
                                background: 'var(--border)',
                              }}
                            >
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${Math.round(src.successRate * 100)}%`,
                                  background:
                                    src.successRate >= 0.8
                                      ? 'var(--green)'
                                      : src.successRate >= 0.5
                                        ? 'orange'
                                        : 'var(--red)',
                                }}
                              />
                            </div>
                            <span style={{ color: 'var(--text-primary)' }}>{Math.round(src.successRate * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {Math.round(src.avgLatencyMs)}ms
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {src.successCount}/{src.total}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: src.degraded ? 'rgba(249,24,128,0.14)' : 'rgba(0,186,124,0.14)',
                              color: src.degraded ? 'var(--red)' : 'var(--green)',
                            }}
                          >
                            {src.degraded ? '已降级' : '正常'}
                          </span>
                        </td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 text-xs"
                          title={src.lastError}
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {src.lastError || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {dashTab === 'stats' && (
          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                数据统计
              </h2>
              <button
                type="button"
                onClick={fetchStats}
                className="rounded px-3 py-1 text-xs"
                style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
              >
                刷新
              </button>
            </div>
            {!statsData ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                暂无统计数据。
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {/* 每日趋势 */}
                <div>
                  <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    近30日抓取趋势（共 {statsData.totalItems} 条）
                  </h3>
                  <div className="flex items-end gap-[2px]" style={{ height: '120px' }}>
                    {(() => {
                      const max = Math.max(...statsData.dailyTrend.map((d) => d.count), 1)
                      return statsData.dailyTrend.map((d) => (
                        <div
                          key={d.date}
                          title={`${d.date}: ${d.count} 条`}
                          className="flex-1 rounded-t"
                          style={{
                            height: `${Math.max((d.count / max) * 100, 2)}%`,
                            background: d.count > 0 ? 'var(--accent)' : 'var(--border)',
                            minWidth: '3px',
                          }}
                        />
                      ))
                    })()}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span>{statsData.dailyTrend[0]?.date.slice(5) || ''}</span>
                    <span>{statsData.dailyTrend[statsData.dailyTrend.length - 1]?.date.slice(5) || ''}</span>
                  </div>
                </div>

                {/* 关键词频率 */}
                <div>
                  <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    关键词命中频率
                  </h3>
                  <div className="space-y-2">
                    {statsData.keywordFrequency.slice(0, 8).map((kw) => {
                      const max = statsData.keywordFrequency[0]?.count || 1
                      return (
                        <div key={kw.keyword} className="flex items-center gap-2 text-xs">
                          <span
                            className="w-20 shrink-0 truncate text-right"
                            title={kw.keyword}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {kw.keyword}
                          </span>
                          <div className="h-4 flex-1 rounded" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-4 rounded"
                              style={{
                                width: `${Math.max((kw.count / max) * 100, 4)}%`,
                                background: 'var(--accent)',
                              }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {kw.count}
                          </span>
                        </div>
                      )
                    })}
                    {statsData.keywordFrequency.length === 0 && (
                      <p style={{ color: 'var(--text-secondary)' }}>暂无数据</p>
                    )}
                  </div>
                </div>

                {/* 来源分布 */}
                <div>
                  <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    来源分布
                  </h3>
                  <div className="space-y-2">
                    {statsData.sourceDistribution.map((sd) => {
                      const max = statsData.sourceDistribution[0]?.count || 1
                      return (
                        <div key={sd.source} className="flex items-center gap-2 text-xs">
                          <span
                            className="w-20 shrink-0 truncate text-right"
                            title={sd.source}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {sd.source}
                          </span>
                          <div className="h-4 flex-1 rounded" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-4 rounded"
                              style={{
                                width: `${Math.max((sd.count / max) * 100, 4)}%`,
                                background: 'rgba(0,186,124,0.7)',
                              }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {sd.count}
                          </span>
                        </div>
                      )
                    })}
                    {statsData.sourceDistribution.length === 0 && (
                      <p style={{ color: 'var(--text-secondary)' }}>暂无数据</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {dashTab === 'history' && (
          <section className={ADMIN_CARD_CLASS}>
            <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              历史日报
            </h2>
            {historyDigests.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                暂无历史日报记录。
              </p>
            ) : (
              <div className="space-y-2">
                {historyDigests.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg px-4 py-3"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <a
                        href={`/admin/posts/${d.id}`}
                        className="text-sm font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {d.title}
                      </a>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {d.digestDate} · {d.itemCount} 条内容 ·{' '}
                        {d.publishedAt ? `发布于 ${d.publishedAt.replace('T', ' ').slice(0, 16)}` : '未发布'}
                      </div>
                    </div>
                    <a
                      href={`/post/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded px-3 py-1 text-xs"
                      style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
                    >
                      查看
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
