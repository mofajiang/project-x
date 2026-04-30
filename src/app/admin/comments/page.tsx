'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'
import { getRiskLevel, getRiskLevelColor } from '@/lib/openrouter-spam-filter'
import { getPostPath } from '@/lib/post-link'

interface Comment {
  id: string
  content: string
  approved: boolean
  riskScore: number
  riskReasons: string
  createdAt: string
  author: { username: string } | null
  guestName: string | null
  ip: string | null
  post: { title: string; slug: string; publicId?: number | null; author?: { username: string } }
}

interface PageData {
  comments: Comment[]
  total: number
  page: number
  totalPages: number
  pendingCount: number
}

export default function AdminCommentsPage() {
  const [data, setData] = useState<PageData>({ comments: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const searchTimer = useRef<any>(null)

  const load = useCallback(
    async (p = 1, q = search, f = filter) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: '20', filter: f })
        if (q) params.set('search', q)
        const res = await fetch(`/api/admin/comments?${params}`, { cache: 'no-store' })
        const json = await res.json()
        if (json && Array.isArray(json.comments)) {
          setData(json)
        } else {
          setData({ comments: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
        }
      } catch {
        setData({ comments: [], total: 0, page: 1, totalPages: 1, pendingCount: 0 })
      } finally {
        setSelected(new Set())
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
    await fetch('/api/admin/comments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })
    toast.success('已通过')
    load(page)
  }

  const remove = async (id: string) => {
    if (!confirm('确认删除该评论？')) return
    await fetch('/api/admin/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    toast.success('已删除')
    load(page)
  }

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    if (selected.size === data.comments.length) setSelected(new Set())
    else setSelected(new Set(data.comments.map((c) => c.id)))
  }

  const batchApprove = async () => {
    if (!selected.size) return
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch('/api/admin/comments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, approved: true }),
        })
      )
    )
    toast.success(`已批量通过 ${selected.size} 条评论`)
    load(page)
  }

  const batchDelete = async () => {
    if (!selected.size) return
    if (!confirm(`确认删除选中的 ${selected.size} 条评论？`)) return
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch('/api/admin/comments', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      )
    )
    toast.success(`已删除 ${selected.size} 条评论`)
    load(page)
  }

  const { comments, total, totalPages, pendingCount } = data

  return (
    <div>
      {/* 顶栏：筛选 + 搜索 */}
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
          placeholder="搜索评论内容、用户名或 IP"
          className="x-admin-input w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-hover)', border: '1px solid transparent', color: 'var(--text-primary)' }}
        />
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div
          className={`${ADMIN_CARD_CLASS} mb-3 flex flex-col gap-2 sm:flex-row sm:items-center`}
          style={{ background: 'rgba(29,155,240,0.1)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            已选 {selected.size} 条
          </span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button
              onClick={batchApprove}
              className="rounded-full px-3 py-2 text-xs font-bold"
              style={{ background: 'rgba(0,186,124,0.15)', color: 'var(--green)' }}
            >
              批量通过
            </button>
            <button
              onClick={batchDelete}
              className="rounded-full px-3 py-2 text-xs font-bold"
              style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
            >
              批量删除
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-full px-3 py-2 text-xs"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 全选 */}
      {comments.length > 0 && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={selected.size === comments.length}
            onChange={toggleAll}
            className="accent-blue-500"
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            全选当前页
          </span>
        </div>
      )}

      {/* 评论列表 */}
      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl p-4"
                style={{ background: 'var(--bg-secondary)', height: 88 }}
              />
            ))
          : comments.map((comment) => (
              <div
                key={comment.id}
                className={`${ADMIN_CARD_CLASS} flex flex-col gap-3 sm:flex-row`}
                style={{
                  background: selected.has(comment.id)
                    ? 'rgba(29,155,240,0.08)'
                    : comment.approved
                      ? 'var(--bg-secondary)'
                      : 'rgba(249,24,128,0.06)',
                  boxShadow: selected.has(comment.id)
                    ? 'inset 0 0 0 1px var(--accent)'
                    : !comment.approved
                      ? 'inset 0 0 0 1px rgba(249,24,128,0.3)'
                      : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(comment.id)}
                  onChange={() => toggleSelect(comment.id)}
                  className="mt-1 shrink-0 accent-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {comment.author?.username || comment.guestName || '匿名'}
                      </span>
                      {!comment.author && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                        >
                          访客
                        </span>
                      )}
                      {comment.ip && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--accent)' }}
                        >
                          IP {comment.ip}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {relativeTime(comment.createdAt)}
                      </span>
                      {!comment.approved && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: '#F9188022', color: 'var(--red)' }}
                        >
                          待审
                        </span>
                      )}
                      {comment.riskScore > 0 && (
                        <span
                          title={`风险原因: ${
                            Array.isArray(comment.riskReasons)
                              ? comment.riskReasons.join(', ')
                              : (() => {
                                  try {
                                    return JSON.parse(comment.riskReasons).join(', ')
                                  } catch {
                                    return comment.riskReasons
                                  }
                                })()
                          }`}
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: `${getRiskLevelColor(comment.riskScore)}22`,
                            color: getRiskLevelColor(comment.riskScore),
                          }}
                        >
                          🤖 {comment.riskScore} 分
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      {!comment.approved && (
                        <button
                          onClick={() => approve(comment.id)}
                          className="min-h-9 rounded-full px-3 py-2 text-xs font-bold hover:opacity-80"
                          style={{ background: 'rgba(0,186,124,0.15)', color: 'var(--green)' }}
                        >
                          通过
                        </button>
                      )}
                      <button
                        onClick={() => remove(comment.id)}
                        className="min-h-9 rounded-full px-3 py-2 text-xs font-bold hover:opacity-80"
                        style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                    {comment.content}
                  </p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    来自文章：
                    <a
                      href={getPostPath(comment.post)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {comment.post.title}
                    </a>
                  </p>
                </div>
              </div>
            ))}
        {!loading && comments.length === 0 && (
          <p className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            暂无评论
          </p>
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
                  className="min-w-[40px] rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: page === p ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: page === p ? '#fff' : 'var(--text-primary)',
                    fontWeight: page === p ? 700 : 400,
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
