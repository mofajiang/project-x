'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ADMIN_PAGE_WRAPPER,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_CARD_CLASS,
  ADMIN_INPUT_CLASS,
  ADMIN_EMPTY_CLASS,
} from '@/components/admin/adminUi'
import { getRiskLevelColor } from '@/lib/openrouter-spam-filter'

interface GuestbookMsg {
  id: string
  content: string
  guestName: string
  guestEmail: string | null
  guestWebsite: string | null
  ip: string | null
  approved: boolean
  riskScore: number
  riskReasons: string
  createdAt: string
  author: { username: string } | null
}

interface PageData {
  messages: GuestbookMsg[]
  total: number
  page: number
  totalPages: number
  pendingCount: number
}

export default function AdminGuestbookPage() {
  const [data, setData] = useState<PageData>({ messages: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const searchTimer = useRef<any>(null)

  const load = useCallback(
    async (p = 1, q = search, f = filter) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: '20', filter: f })
        if (q) params.set('search', q)
        const res = await fetch(`/api/admin/guestbook?${params}`, { cache: 'no-store' })
        const json = await res.json()
        if (json && Array.isArray(json.messages)) {
          setData(json)
        } else {
          setData({ messages: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
        }
      } catch {
        setData({ messages: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
      } finally {
        setLoading(false)
      }
    },
    [search, filter]
  )

  useEffect(() => {
    load(1, search, filter)
  }, [filter])

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      load(1, v, filter)
    }, 400)
  }

  const goPage = (p: number) => {
    setPage(p)
    load(p, search, filter)
  }

  const approve = async (id: string) => {
    await fetch('/api/admin/guestbook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })
    toast.success('已通过')
    load(page)
  }

  const reject = async (id: string) => {
    await fetch('/api/admin/guestbook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    })
    toast.success('已驳回')
    load(page)
  }

  const remove = async (id: string) => {
    if (!confirm('确认删除该留言？')) return
    await fetch('/api/admin/guestbook', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    toast.success('已删除')
    load(page)
  }

  const { messages, total, totalPages, pendingCount } = data

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>
        留言管理
      </h1>

      {/* 筛选 + 搜索 */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f)
                setPage(1)
              }}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: filter === f ? 'var(--accent)' : 'var(--bg-secondary)',
                color: filter === f ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {{ all: '全部', pending: '待审核', approved: '已通过' }[f]}
              {f === 'pending' && pendingCount > 0 && <span className="ml-1 text-xs">({pendingCount})</span>}
              {f === 'all' && <span className="ml-1 text-xs">({total})</span>}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索留言内容、昵称或 IP"
          className={ADMIN_INPUT_CLASS}
          style={{ background: 'var(--bg-hover)', border: '1px solid transparent', color: 'var(--text-primary)' }}
        />
      </div>

      {/* 留言列表 */}
      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl p-4"
                style={{ background: 'var(--bg-secondary)', height: 88 }}
              />
            ))
          : messages.map((msg) => (
              <div
                key={msg.id}
                className={`${ADMIN_CARD_CLASS} flex flex-col gap-3`}
                style={{
                  background: msg.approved ? 'var(--bg-secondary)' : 'rgba(249,24,128,0.06)',
                  boxShadow: msg.approved ? 'none' : 'inset 0 0 0 1px rgba(249,24,128,0.3)',
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {msg.author?.username || msg.guestName}
                    </span>
                    {!msg.author && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                      >
                        访客
                      </span>
                    )}
                    {msg.guestEmail && (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {msg.guestEmail}
                      </span>
                    )}
                    {msg.guestWebsite && (
                      <a
                        href={msg.guestWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline hover:no-underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        网站
                      </a>
                    )}
                    {msg.ip && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--accent)' }}
                      >
                        IP {msg.ip}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {relativeTime(msg.createdAt)}
                    </span>
                    {!msg.approved && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{ background: '#F9188022', color: 'var(--red)' }}
                      >
                        待审
                      </span>
                    )}
                    {msg.riskScore > 0 && (
                      <span
                        title={`风险原因: ${(() => {
                          try {
                            return JSON.parse(msg.riskReasons).join(', ')
                          } catch {
                            return msg.riskReasons
                          }
                        })()}`}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `${getRiskLevelColor(msg.riskScore)}22`,
                          color: getRiskLevelColor(msg.riskScore),
                        }}
                      >
                        🤖 {msg.riskScore} 分
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!msg.approved && (
                      <button
                        onClick={() => approve(msg.id)}
                        className="min-h-9 rounded-full px-3 py-2 text-xs font-bold hover:opacity-80"
                        style={{ background: 'rgba(0,186,124,0.15)', color: 'var(--green)' }}
                      >
                        通过
                      </button>
                    )}
                    {msg.approved && (
                      <button
                        onClick={() => reject(msg.id)}
                        className="min-h-9 rounded-full px-3 py-2 text-xs font-bold hover:opacity-80"
                        style={{ background: 'rgba(255,159,10,0.15)', color: '#ff9f0a' }}
                      >
                        驳回
                      </button>
                    )}
                    <button
                      onClick={() => remove(msg.id)}
                      className="min-h-9 rounded-full px-3 py-2 text-xs font-bold hover:opacity-80"
                      style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                  {msg.content}
                </p>
              </div>
            ))}
        {!loading && messages.length === 0 && (
          <div className={ADMIN_EMPTY_CLASS} style={{ color: 'var(--text-secondary)' }}>
            <p>暂无留言</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => goPage(page - 1)}
            disabled={page <= 1}
            className="rounded-full px-3 py-2 text-sm disabled:opacity-40"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            ‹ 上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '...')[]>((acc, p, i, arr) => {
              if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-1" style={{ color: 'var(--text-secondary)' }}>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => goPage(p as number)}
                  className="h-9 w-9 rounded-full text-sm font-medium"
                  style={{
                    background: page === p ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: page === p ? '#fff' : 'var(--text-primary)',
                    border: page === p ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full px-3 py-2 text-sm disabled:opacity-40"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            下一页 ›
          </button>
        </div>
      )}
    </div>
  )
}
