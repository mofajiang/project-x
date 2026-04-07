'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface FriendLink {
  id: string
  name: string
  url: string
  description?: string
  favicon?: string
  status: string
  rejectionReason?: string
  hasReciprocal: boolean
  reciprocalChecked: boolean
  aiScore: number
  sortOrder: number
  createdAt: string
}

export default function AdminFriendLinksPage() {
  const [links, setLinks] = useState<FriendLink[]>([])
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({})
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)

  const limit = 20

  const fetchLinks = async (pageNum: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/friend-links?status=${status}&page=${pageNum}&limit=${limit}`)
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }
      const data = await res.json()
      const nextLinks = Array.isArray(data.links) ? data.links : []
      setLinks(nextLinks)
      setOrderDrafts(prev => {
        const next: Record<string, string> = {}
        for (const item of nextLinks) {
          const keep = prev[item.id]
          next[item.id] = keep !== undefined ? keep : String(item.sortOrder ?? 0)
        }
        return next
      })
      setTotal(typeof data.total === 'number' ? data.total : 0)
      setPage(pageNum)
    } catch (error) {
      console.error('Failed to fetch friend links:', error)
      toast.error('获取友链列表失败')
      setLinks([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks(1)
  }, [status])

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('已批准')
        fetchLinks(page)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('请输入拒绝原因')
      return
    }

    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectReason }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('已拒绝')
        setRejectingId(null)
        setRejectReason('')
        fetchLinks(page)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此友链吗？')) return
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('已删除')
        fetchLinks(page)
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  const handleRecheck = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'recheck-reciprocal' }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('已重新检查')
        fetchLinks(page)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleAiReview = async (id: string) => {
    setReviewingId(id)
    try {
      const res = await fetch('/api/friend-links/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: id }),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(`AI 审核完成 (风险评分: ${result.score})`)
        fetchLinks(page)
      } else {
        const error = await res.json()
        toast.error(error.error || 'AI 审核失败')
      }
    } catch (error) {
      toast.error('发起审核失败')
    } finally {
      setReviewingId(null)
    }
  }

  const handleChangeOrder = async (id: string, delta: 1 | -1) => {
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'change-order', delta }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success(delta > 0 ? '已上移' : '已下移')
        fetchLinks(page)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '排序失败')
      }
    } catch {
      toast.error('排序失败')
    }
  }

  const handleSetOrder = async (id: string) => {
    const raw = (orderDrafts[id] ?? '').trim()
    if (!/^[-+]?\d+$/.test(raw)) {
      toast.error('请输入整数排序权重')
      return
    }

    const value = Number(raw)
    setSavingOrderId(id)
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'set-order', sortOrder: value }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('排序权重已保存')
        fetchLinks(page)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSavingOrderId(null)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          友情链接管理
        </h1>
        <Link href="/links" className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
          查看友链页面
        </Link>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-3 mb-6">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button
            key={s}
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              status === s ? 'opacity-100' : 'opacity-60 hover:opacity-80'
            }`}
            style={{
              background: status === s ? 'var(--accent)' : 'var(--bg-secondary)',
              color: status === s ? '#fff' : 'var(--text-primary)',
            }}
          >
            {{
              pending: '待审核',
              approved: '已通过',
              rejected: '已拒绝',
              all: '全部',
            }[s] || s}
          </button>
        ))}
      </div>

      {/* 友链列表 */}
      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
          加载中...
        </div>
      ) : links.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
          暂无友链
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div
              key={link.id}
              className="rounded-xl p-6 border"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* 左侧信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      {link.favicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={link.favicon} alt={link.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{link.name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {link.name}
                      </h3>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {link.url}
                        </a>
                      </p>
                    </div>
                  </div>

                  {link.description && (
                    <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {link.description}
                    </p>
                  )}

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-2">
                    {link.hasReciprocal && (
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                      >
                        ✓ 已互链
                      </span>
                    )}
                    {link.status === 'rejected' && (
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                      >
                        ✕ 已拒绝
                      </span>
                    )}
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b' }}
                    >
                      AI 评分: {link.aiScore}
                    </span>
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--accent)' }}
                    >
                      排序权重: {link.sortOrder}
                    </span>
                    <span className="text-xs px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(link.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {link.rejectionReason && (
                    <p className="text-xs mt-2 p-2 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      拒绝原因: {link.rejectionReason}
                    </p>
                  )}
                </div>

                {/* 右侧操作 */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={orderDrafts[link.id] ?? String(link.sortOrder)}
                      onChange={e => setOrderDrafts(prev => ({ ...prev, [link.id]: e.target.value }))}
                      className="w-20 px-2 py-2 rounded-lg text-sm border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      title="手动设置排序权重"
                    />
                    <button
                      onClick={() => handleSetOrder(link.id)}
                      disabled={savingOrderId === link.id}
                      className="px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-60"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      {savingOrderId === link.id ? '保存中' : '保存'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChangeOrder(link.id, 1)}
                      className="px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleChangeOrder(link.id, -1)}
                      className="px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      title="下移"
                    >
                      ↓
                    </button>
                  </div>
                  {link.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(link.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80"
                        style={{ background: '#22c55e' }}
                      >
                        批准
                      </button>
                      <button
                        onClick={() => setRejectingId(link.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80"
                        style={{ background: '#ef4444' }}
                      >
                        拒绝
                      </button>
                      <button
                        onClick={() => handleAiReview(link.id)}
                        disabled={reviewingId === link.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80 disabled:opacity-60"
                        style={{ background: '#f59e0b' }}
                      >
                        {reviewingId === link.id ? '审核中...' : '🤖 AI 审核'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRecheck(link.id)}
                    className="px-4 py-2 rounded-lg text-sm transition-all"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    重新检查互链
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-80"
                    style={{ background: '#64748b' }}
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* 拒绝原因输入框 */}
              {rejectingId === link.id && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="text"
                    placeholder="输入拒绝原因..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-transparent outline-none border text-sm mb-3"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(link.id)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ background: '#ef4444' }}
                    >
                      确认拒绝
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null)
                        setRejectReason('')
                      }}
                      className="flex-1 px-4 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > limit && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => fetchLinks(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            上一页
          </button>
          <span style={{ color: 'var(--text-secondary)' }}>
            第 {page} / {Math.ceil(total / limit)} 页
          </span>
          <button
            onClick={() => fetchLinks(Math.min(Math.ceil(total / limit), page + 1))}
            disabled={page >= Math.ceil(total / limit)}
            className="px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
