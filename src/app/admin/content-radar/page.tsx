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

type MainTab = 'config' | 'publish' | 'preview' | 'data'

const SOURCE_GROUPS = {
  news: [
    { id: 'google', label: 'Google News', hint: '国际' },
    { id: 'bing', label: 'Bing News', hint: '国内' },
    { id: 'baidu', label: '百度新闻', hint: '国内中文' },
    { id: 'yahoo', label: 'Yahoo News', hint: '国际英文' },
  ],
  blog: [
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
  ],
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
  const [mainTab, setMainTab] = useState<MainTab>('config')
  const [dataSubTab, setDataSubTab] = useState<'health' | 'stats' | 'history'>('health')
  const [sourceGroupsExpanded, setSourceGroupsExpanded] = useState<{ news: boolean; blog: boolean }>({
    news: true,
    blog: false,
  })
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
      {/* Header */}
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

      {/* Main Tab Navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {(
          [
            { id: 'config', label: '配置' },
            { id: 'publish', label: '发布设置' },
            { id: 'preview', label: '预览' },
            { id: 'data', label: '数据' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMainTab(tab.id)
              if (tab.id === 'data') {
                fetchHealth()
                fetchStats()
                fetchHistory()
              }
            }}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: mainTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: mainTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.6fr)]">
        {/* Main Content Area */}
        <div>
          {/* 配置 Tab */}
          {mainTab === 'config' && (
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
                {/* 关键词 */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      关键词
                    </label>
                    <textarea
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      rows={5}
                      className={`${ADMIN_INPUT_CLASS} min-h-[120px] resize-y`}
                      style={{
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                      }}
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
                      style={{
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                      }}
                      placeholder="例如：日报, AI, 资讯"
                    />
                  </div>
                </div>

                {/* 额外 RSS */}
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    额外 RSS 源（可选）
                  </label>
                  <textarea
                    value={feedsInput}
                    onChange={(e) => setFeedsInput(e.target.value)}
                    rows={3}
                    className={`${ADMIN_INPUT_CLASS} min-h-[80px] resize-y`}
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                    placeholder="逗号或换行分隔，例如：https://a.com/feed.xml, https://b.com/rss"
                  />
                </div>

                {/* 抓取源 */}
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    抓取源
                  </label>
                  <div className="space-y-2">
                    {/* 新闻搜索 */}
                    <div
                      className="rounded-lg p-3"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => setSourceGroupsExpanded((prev) => ({ ...prev, news: !prev.news }))}
                        className="mb-2 flex w-full items-center justify-between text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span>新闻搜索</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{sourceGroupsExpanded.news ? '▲' : '▼'}</span>
                      </button>
                      {sourceGroupsExpanded.news && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {SOURCE_GROUPS.news.map((src) => (
                            <label key={src.id} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={(status.config.sources || []).includes(src.id)}
                                onChange={(e) => {
                                  const cur = status.config.sources || ['google']
                                  const next = e.target.checked
                                    ? [...cur.filter((s) => s !== src.id), src.id]
                                    : cur.filter((s) => s !== src.id)
                                  setConfig('sources', next.length ? next : ['google'])
                                }}
                                style={{ accentColor: 'var(--accent)' }}
                              />
                              <span>{src.label}</span>
                              <span className="opacity-50">({src.hint})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 博客/社区 */}
                    <div
                      className="rounded-lg p-3"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => setSourceGroupsExpanded((prev) => ({ ...prev, blog: !prev.blog }))}
                        className="mb-2 flex w-full items-center justify-between text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span>博客 / 社区</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{sourceGroupsExpanded.blog ? '▲' : '▼'}</span>
                      </button>
                      {sourceGroupsExpanded.blog && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {SOURCE_GROUPS.blog.map((src) => (
                            <label key={src.id} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={(status.config.sources || []).includes(src.id)}
                                onChange={(e) => {
                                  const cur = status.config.sources || ['google']
                                  const next = e.target.checked
                                    ? [...cur.filter((s) => s !== src.id), src.id]
                                    : cur.filter((s) => s !== src.id)
                                  setConfig('sources', next.length ? next : ['google'])
                                }}
                                style={{ accentColor: 'var(--accent)' }}
                              />
                              <span>{src.label}</span>
                              <span className="opacity-50">({src.hint})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 域名过滤 */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      仅保留这些域名（可选）
                    </label>
                    <textarea
                      value={includeDomainsInput}
                      onChange={(e) => setIncludeDomainsInput(e.target.value)}
                      rows={3}
                      className={`${ADMIN_INPUT_CLASS} min-h-[72px] resize-y`}
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
                      rows={3}
                      className={`${ADMIN_INPUT_CLASS} min-h-[72px] resize-y`}
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
          )}

          {/* 发布设置 Tab */}
          {mainTab === 'publish' && (
            <section
              className={ADMIN_CARD_CLASS}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                发布设置
              </h2>

              {/* 调度与容量 */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                  调度与容量
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      定时周期
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
                      分钟
                    </p>
                  </div>
                  <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      每篇日报条数
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
                      最多收录
                    </p>
                  </div>
                  <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      去重保留天数
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
                      天
                    </p>
                  </div>
                  <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                    <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      文章时效过滤
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
                      天内发布
                    </p>
                  </div>
                </div>
              </div>

              {/* 选项开关 */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                  选项
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label
                    className="flex items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={status.config.autoPublish}
                      onChange={(e) => setConfig('autoPublish', e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    自动发布
                  </label>
                  <label
                    className="flex items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={status.config.useAi}
                      onChange={(e) => setConfig('useAi', e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    AI 生成
                  </label>
                  <label
                    className="flex items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={status.config.standardMarkdown}
                      onChange={(e) => setConfig('standardMarkdown', e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    标准 Markdown
                  </label>
                  <label
                    className="flex items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={status.config.useShortLinks}
                      onChange={(e) => setConfig('useShortLinks', e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    短链接
                  </label>
                </div>
              </div>

              {/* Webhook */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                  Webhook 通知
                </p>
                <div className="rounded-lg p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <label className="mb-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={status.config.webhookEnabled}
                      onChange={(e) => setConfig('webhookEnabled', e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      启用 Webhook
                    </span>
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
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    每次抓取完成后会向此 URL 发送 POST JSON 通知。
                  </p>
                </div>
              </div>

              {/* AI 提示词 */}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  AI 额外提示词（可选）
                </label>
                <textarea
                  value={status.config.prompt}
                  onChange={(e) => setConfig('prompt', e.target.value)}
                  rows={3}
                  className={`${ADMIN_INPUT_CLASS} min-h-[80px] resize-y`}
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                  placeholder="例如：更偏技术情报风格，少一些空泛总结，多一些要点提炼。"
                />
              </div>
            </section>
          )}

          {/* 预览 Tab */}
          {mainTab === 'preview' && (
            <section
              className={ADMIN_CARD_CLASS}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  文案预览
                </h2>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewing}
                  className={ADMIN_BTN_SECONDARY}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  {previewing ? '生成中...' : '重新生成预览'}
                </button>
              </div>
              {!previewResult ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    点击「重新生成预览」查看日报文案效果
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                    预览不会实际发布文章，不会消耗 AI 额度
                  </p>
                </div>
              ) : (
                <div>
                  <div
                    className="mb-3 flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span>{previewResult.message}</span>
                    <span>·</span>
                    <span>命中 {previewResult.matchedCount} 条</span>
                    <span>·</span>
                    <span>新增 {previewResult.newCount} 条</span>
                    <span>·</span>
                    <span>{previewResult.digestDate}</span>
                  </div>
                  <div
                    className="max-h-[600px] overflow-y-auto rounded-2xl border p-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <MarkdownRenderer content={previewResult.content} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 数据 Tab */}
          {mainTab === 'data' && (
            <section
              className={ADMIN_CARD_CLASS}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              {/* Sub Tab Navigation */}
              <div className="mb-4 flex gap-2">
                {(
                  [
                    { id: 'health', label: '源健康状态' },
                    { id: 'stats', label: '数据统计' },
                    { id: 'history', label: '历史日报' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setDataSubTab(tab.id)
                      if (tab.id === 'health') fetchHealth()
                      if (tab.id === 'stats') fetchStats()
                      if (tab.id === 'history') fetchHistory()
                    }}
                    className="rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: dataSubTab === tab.id ? 'var(--accent)' : 'transparent',
                      color: dataSubTab === tab.id ? '#fff' : 'var(--text-secondary)',
                      border: dataSubTab === tab.id ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 健康状态 */}
              {dataSubTab === 'health' && (
                <div>
                  {healthData.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      暂无健康数据，运行一次抓取后即可看到。
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr
                            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                            className="border-b"
                          >
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
                                  <div className="h-2 w-14 rounded-full" style={{ background: 'var(--border)' }}>
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
                                  <span style={{ color: 'var(--text-primary)' }}>
                                    {Math.round(src.successRate * 100)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                                {src.avgLatencyMs > 0 ? `${(src.avgLatencyMs / 1000).toFixed(1)}s` : '-'}
                              </td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                                {src.total}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs"
                                  style={{
                                    background: src.degraded ? 'rgba(240,154,47,0.12)' : 'rgba(0,186,124,0.12)',
                                    color: src.degraded ? 'orange' : 'var(--green)',
                                  }}
                                >
                                  {src.degraded ? '⚠ 降级' : '✓ 正常'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {src.lastError ? src.lastError.slice(0, 40) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 数据统计 */}
              {dataSubTab === 'stats' && (
                <div>
                  {!statsData ? (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      暂无统计数据。
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* 趋势图 */}
                      <div>
                        <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          每日抓取趋势
                        </h3>
                        <div className="flex items-end gap-1" style={{ height: '120px' }}>
                          {(() => {
                            const max = statsData.dailyTrend[0]?.count || 1
                            return statsData.dailyTrend.map((d) => (
                              <div
                                key={d.date}
                                className="flex-1 rounded-t"
                                title={`${d.date}: ${d.count} 条`}
                                style={{
                                  height: `${Math.max((d.count / max) * 100, 2)}%`,
                                  background: d.count > 0 ? 'var(--accent)' : 'var(--border)',
                                  minWidth: '3px',
                                }}
                              />
                            ))
                          })()}
                        </div>
                        <div
                          className="mt-1 flex justify-between text-[10px]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
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
                      <div className="lg:col-span-2">
                        <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          来源分布
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {statsData.sourceDistribution.map((sd) => {
                            const max = statsData.sourceDistribution[0]?.count || 1
                            return (
                              <div
                                key={sd.source}
                                className="flex items-center gap-2 rounded-lg p-2"
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                              >
                                <span className="w-16 truncate text-xs" style={{ color: 'var(--text-primary)' }}>
                                  {sd.source}
                                </span>
                                <div className="h-2 flex-1 rounded" style={{ background: 'var(--border)' }}>
                                  <div
                                    className="h-2 rounded"
                                    style={{
                                      width: `${Math.max((sd.count / max) * 100, 4)}%`,
                                      background: 'rgba(0,186,124,0.7)',
                                    }}
                                  />
                                </div>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
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
                </div>
              )}

              {/* 历史日报 */}
              {dataSubTab === 'history' && (
                <div>
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
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar - Log Panel */}
        <aside className="space-y-4">
          <section
            className={ADMIN_CARD_CLASS}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex gap-2">
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
                  {status.logs.running ? `${status.logs.source === 'manual' ? '手动' : '定时'}执行中` : '空闲'}
                </span>
              )}
            </div>
            {logTab === 'live' && (
              <div
                ref={logContainerRef}
                className="max-h-[360px] overflow-y-auto rounded-2xl border px-3 py-3 font-mono text-xs leading-6"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
              >
                {status.logs.entries.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)' }}>暂无抓取日志，点击「立即抓取」后会在此实时显示。</p>
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
                      <span style={{ color: 'var(--text-secondary)' }}>{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {logTab === 'history' && (
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {historyRuns.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    暂无历史记录。
                  </p>
                ) : (
                  historyRuns.map((run) => (
                    <button
                      key={run.runId}
                      type="button"
                      onClick={() => loadHistoryEntries(run.runId)}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs"
                      style={{
                        background: historyRunId === run.runId ? 'var(--bg)' : 'transparent',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)' }}>
                        {run.source === 'manual' ? '手动' : '定时'} ·{' '}
                        {formatTimeShort(run.startedAt, { timeZone: 'Asia/Shanghai' })}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{run.entryCount} 条日志</div>
                    </button>
                  ))
                )}
                {historyRunId && historyEntries.length > 0 && (
                  <div
                    className="max-h-[200px] overflow-y-auto rounded-lg border p-2 font-mono text-xs leading-5"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                  >
                    {historyEntries.map((entry) => (
                      <div key={entry.id} className="break-words">
                        <span style={{ color: 'var(--text-secondary)' }}>{entry.level.toUpperCase()}</span>
                        <span style={{ color: 'var(--text-secondary)' }}> · </span>
                        <span>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
