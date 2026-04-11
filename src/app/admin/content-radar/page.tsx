'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { IMEInput } from '@/components/ui/IMEInput'
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
  prompt: string
  lastRunAt: string
  lastStatus: string
  lastMessage: string
  lastPostId: string
  maxItems: number
  keepDays: number
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
    prompt: '',
    lastRunAt: '',
    lastStatus: '',
    lastMessage: '',
    lastPostId: '',
    maxItems: 12,
    keepDays: 14,
  },
  recentItems: [],
  totalSeen: 0,
}

function textToList(value: string) {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AdminContentRadarPage() {
  const [status, setStatus] = useState<RadarStatus>(EMPTY_STATUS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [keywordsInput, setKeywordsInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [feedsInput, setFeedsInput] = useState('')
  const [includeDomainsInput, setIncludeDomainsInput] = useState('')
  const [excludeDomainsInput, setExcludeDomainsInput] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/content-radar', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setStatus(data)
      setKeywordsInput((data.config.keywords || []).join('\n'))
      setTagsInput((data.config.tags || []).join(', '))
      setFeedsInput((data.config.extraFeeds || []).join('\n'))
      setIncludeDomainsInput((data.config.includeDomains || []).join('\n'))
      setExcludeDomainsInput((data.config.excludeDomains || []).join('\n'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const setConfig = <K extends keyof RadarConfig>(key: K, value: RadarConfig[K]) => {
    setStatus((current) => ({ ...current, config: { ...current.config, [key]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
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
      toast.success('内容雷达配置已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/content-radar/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || '执行失败')
      toast.success(data.message || '执行完成')
      await fetchStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '执行失败')
    } finally {
      setRunning(false)
    }
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
                  placeholder="每行一个关键词，例如：\nAI 编程\n大模型\nRAG"
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
                  placeholder="每行一个 RSS 地址，例如：\nhttps://example.com/feed.xml"
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
                    placeholder="每行一个域名，例如：\n36kr.com\ninfoq.cn"
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
                    placeholder="每行一个域名，例如：\nspam-site.example"
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
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
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
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
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'transparent' }}
                />
                <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  这里只保留标题、链接、摘要与指纹，超过时会自动清理旧记录。
                </p>
              </div>

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
                </div>
                <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  未配置 AI 时会自动回退到模板生成，不会中断抓取流程。
                </p>
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
          </section>
        </div>

        <aside className="space-y-6">
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
                <span style={{ color: 'var(--text-primary)' }}>{status.config.lastRunAt || '暂无'}</span>
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
            <div className="space-y-3">
              {status.recentItems.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  还没有抓取记录。
                </p>
              )}
              {status.recentItems.map((item) => (
                <div key={item.hash} className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg)' }}>
                  <div
                    className="mb-2 flex flex-wrap items-center gap-2 text-[11px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span>{item.digestDate}</span>
                    <span>·</span>
                    <span>{item.source || '未知来源'}</span>
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:underline"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.title}
                  </a>
                  <p className="mt-2 line-clamp-3 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                    {item.summary || '无摘要'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full px-2 py-1 text-[10px]"
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
    </div>
  )
}
