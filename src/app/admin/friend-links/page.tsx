'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'
import { StorageImagePicker } from '@/components/admin/StorageImagePicker'

interface FriendLink {
  id: string
  name: string
  url: string
  description?: string
  favicon?: string
  email?: string
  status: string
  rejectionReason?: string
  hasReciprocal: boolean
  reciprocalChecked: boolean
  aiScore: number
  sortOrder: number
  showInSidebar: boolean
  createdAt: string
}

type LinkForm = {
  name: string
  url: string
  description: string
  favicon: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  sortOrder: string
  showInSidebar: boolean
}

const EMPTY_FORM: LinkForm = {
  name: '',
  url: '',
  description: '',
  favicon: '',
  email: '',
  status: 'approved',
  sortOrder: '0',
  showInSidebar: true,
}

export default function AdminFriendLinksPage() {
  const [links, setLinks] = useState<FriendLink[]>([])
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({})
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<LinkForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LinkForm>(EMPTY_FORM)

  const limit = 20

  const filteredLinks = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return links
    return links.filter(link => {
      const name = (link.name || '').toLowerCase()
      const url = (link.url || '').toLowerCase()
      const desc = (link.description || '').toLowerCase()
      return name.includes(k) || url.includes(k) || desc.includes(k)
    })
  }, [links, keyword])

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

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('请输入名称')
      return
    }
    if (!createForm.url.trim()) {
      toast.error('请输入 URL')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/friend-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          sortOrder: Number(createForm.sortOrder || 0),
        }),
      })

      if (res.ok) {
        toast.success('友链已创建')
        setCreateForm(EMPTY_FORM)
        fetchLinks(1)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '创建失败')
      }
    } catch {
      toast.error('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (link: FriendLink) => {
    setEditingId(link.id)
    setEditForm({
      name: link.name || '',
      url: link.url || '',
      description: link.description || '',
      favicon: link.favicon || '',
      email: link.email || '',
      status: (['pending', 'approved', 'rejected'].includes(link.status) ? link.status : 'pending') as LinkForm['status'],
      sortOrder: String(link.sortOrder ?? 0),
      showInSidebar: !!link.showInSidebar,
    })
  }

  const handleUpdateBasic = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error('请输入名称')
      return
    }
    if (!editForm.url.trim()) {
      toast.error('请输入 URL')
      return
    }

    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-basic',
          ...editForm,
          sortOrder: Number(editForm.sortOrder || 0),
        }),
      })

      if (res.ok) {
        toast.success('已保存')
        setEditingId(null)
        fetchLinks(page)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    }
  }

  const handleToggleSidebar = async (id: string, showInSidebar: boolean) => {
    try {
      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-sidebar', showInSidebar }),
      })
      if (res.ok) {
        toast.success(showInSidebar ? '已显示在右侧栏' : '已从右侧栏隐藏')
        fetchLinks(page)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="sticky top-0 z-20 flex items-center justify-end gap-2 px-3 py-2 rounded-2xl mb-4 -mx-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        <Link href="/links" className="px-3 py-1.5 rounded-full text-xs font-medium hidden sm:block" style={{ background: 'var(--bg-hover)', color: 'var(--accent)' }}>
          前台友链页
        </Link>
        <button
          onClick={() => { setCreating(true); setCreateForm(EMPTY_FORM) }}
          className="px-4 py-2 rounded-full text-sm font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >+ 添加</button>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>集中处理审核、排序与展示策略</p>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
        <section className="rounded-2xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="rounded-2xl p-2.5 mb-2.5 flex flex-col md:flex-row gap-2 md:items-center md:justify-between" style={{ background: 'linear-gradient(135deg, rgba(29,155,240,0.15), rgba(16,185,129,0.08))' }}>
            <div className="flex flex-wrap gap-2">
              {['pending', 'approved', 'rejected', 'all'].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setStatus(s)
                    setPage(1)
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
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
          </div>

          <div className="rounded-xl p-2 mb-2" style={{ background: 'var(--bg-hover)' }}>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索名称 / URL / 简介"
              className="w-full px-3 py-1.5 rounded-lg border bg-transparent outline-none text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {loading ? (
            <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>暂无友链</div>
          ) : (
            <div className="space-y-2">
              {filteredLinks.map(link => (
            <div
              key={link.id}
              className="rounded-xl p-3 border"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                {/* 左侧信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-xs"
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
                    <p className="text-xs mb-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {link.description}
                    </p>
                  )}

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1.5">
                    {link.hasReciprocal && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                      >
                        ✓ 已互链
                      </span>
                    )}
                    {link.status === 'rejected' && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                      >
                        ✕ 已拒绝
                      </span>
                    )}
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b' }}
                    >
                      AI 评分: {link.aiScore}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--accent)' }}
                    >
                      排序权重: {link.sortOrder}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: link.showInSidebar ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: link.showInSidebar ? '#22c55e' : '#64748b' }}
                    >
                      {link.showInSidebar ? '侧栏显示' : '仅友链页显示'}
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
                <div className="grid grid-cols-2 gap-1.5 w-[172px] flex-shrink-0">
                  <div className="col-span-2 flex items-center gap-1.5">
                    <input
                      type="number"
                      value={orderDrafts[link.id] ?? String(link.sortOrder)}
                      onChange={e => setOrderDrafts(prev => ({ ...prev, [link.id]: e.target.value }))}
                      className="w-20 px-2 py-1.5 rounded-lg text-xs border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      title="手动设置排序权重"
                    />
                    <button
                      onClick={() => handleSetOrder(link.id)}
                      disabled={savingOrderId === link.id}
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs transition-all disabled:opacity-60"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      {savingOrderId === link.id ? '保存中' : '保存'}
                    </button>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleChangeOrder(link.id, 1)}
                      className="px-2 py-1.5 rounded-lg text-xs transition-all"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleChangeOrder(link.id, -1)}
                      className="px-2 py-1.5 rounded-lg text-xs transition-all"
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
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
                        style={{ background: '#22c55e' }}
                      >
                        批准
                      </button>
                      <button
                        onClick={() => setRejectingId(link.id)}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
                        style={{ background: '#ef4444' }}
                      >
                        拒绝
                      </button>
                      <button
                        onClick={() => handleAiReview(link.id)}
                        disabled={reviewingId === link.id}
                        className="col-span-2 px-2 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80 disabled:opacity-60"
                        style={{ background: '#f59e0b' }}
                      >
                        {reviewingId === link.id ? '审核中...' : '🤖 AI 审核'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openEdit(link)}
                    className="col-span-2 px-2 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggleSidebar(link.id, !link.showInSidebar)}
                    className="col-span-2 px-2 py-1.5 rounded-lg text-xs transition-all"
                    style={{
                      background: link.showInSidebar ? 'rgba(100,116,139,0.15)' : 'rgba(34,197,94,0.12)',
                      color: link.showInSidebar ? '#475569' : '#16a34a',
                    }}
                  >
                    {link.showInSidebar ? '侧栏隐藏' : '侧栏显示'}
                  </button>
                  <button
                    onClick={() => handleRecheck(link.id)}
                    className="col-span-2 px-2 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    重新检查互链
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="col-span-2 px-2 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
                    style={{ background: '#64748b' }}
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* 拒绝原因输入框 */}
              {rejectingId === link.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="text"
                    placeholder="输入拒绝原因..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-transparent outline-none border text-sm mb-2"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(link.id)}
                      className="flex-1 px-4 py-1.5 rounded-lg text-sm font-medium text-white"
                      style={{ background: '#ef4444' }}
                    >
                      确认拒绝
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null)
                        setRejectReason('')
                      }}
                      className="flex-1 px-4 py-1.5 rounded-lg text-sm"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {editingId === link.id && (
                <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={editForm.name} onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))} placeholder="名称"
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <input value={editForm.url} onChange={e => setEditForm(v => ({ ...v, url: e.target.value }))} placeholder="https://example.com"
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <input value={editForm.description} onChange={e => setEditForm(v => ({ ...v, description: e.target.value }))} placeholder="简介（可选）"
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <div className="flex items-center gap-2">
                      <input value={editForm.favicon} onChange={e => setEditForm(v => ({ ...v, favicon: e.target.value }))} placeholder="头像URL（可选）"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      <StorageImagePicker
                        buttonText="选择"
                        onSelect={(url) => setEditForm(v => ({ ...v, favicon: url }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      />
                    </div>
                    <input value={editForm.email} onChange={e => setEditForm(v => ({ ...v, email: e.target.value }))} placeholder="邮箱（可选）"
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <input value={editForm.sortOrder} onChange={e => setEditForm(v => ({ ...v, sortOrder: e.target.value }))} placeholder="排序权重"
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>状态</label>
                    <select value={editForm.status} onChange={e => setEditForm(v => ({ ...v, status: e.target.value as LinkForm['status'] }))}
                      className="px-3 py-1.5 rounded-lg bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <option value="approved">已通过</option>
                      <option value="pending">待审核</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={editForm.showInSidebar} onChange={e => setEditForm(v => ({ ...v, showInSidebar: e.target.checked }))} />
                      在右侧栏显示
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateBasic(link.id)} className="px-4 py-1.5 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}>
                      保存编辑
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
            </div>
          )}

          {total > limit && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => fetchLinks(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 rounded-xl disabled:opacity-50 text-sm"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                上一页
              </button>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                第 {page} / {Math.ceil(total / limit)} 页
              </span>
              <button
                onClick={() => fetchLinks(Math.min(Math.ceil(total / limit), page + 1))}
                disabled={page >= Math.ceil(total / limit)}
                className="px-4 py-1.5 rounded-xl disabled:opacity-50 text-sm"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                下一页
              </button>
            </div>
          )}
        </section>

        <aside className="rounded-2xl p-3 h-fit sticky top-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>手动新增友链</h2>
          <div className="space-y-2">
            <input value={createForm.name} onChange={e => setCreateForm(v => ({ ...v, name: e.target.value }))} placeholder="名称"
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={createForm.url} onChange={e => setCreateForm(v => ({ ...v, url: e.target.value }))} placeholder="https://example.com"
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={createForm.description} onChange={e => setCreateForm(v => ({ ...v, description: e.target.value }))} placeholder="简介（可选）"
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex items-center gap-2">
              <input value={createForm.favicon} onChange={e => setCreateForm(v => ({ ...v, favicon: e.target.value }))} placeholder="头像URL（可选）"
                className="flex-1 px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <StorageImagePicker
                buttonText="选择"
                onSelect={(url) => setCreateForm(v => ({ ...v, favicon: url }))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
              />
            </div>
            <input value={createForm.email} onChange={e => setCreateForm(v => ({ ...v, email: e.target.value }))} placeholder="邮箱（可选）"
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={createForm.sortOrder} onChange={e => setCreateForm(v => ({ ...v, sortOrder: e.target.value }))} placeholder="排序权重"
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="mt-2.5 space-y-2">
            <select value={createForm.status} onChange={e => setCreateForm(v => ({ ...v, status: e.target.value as LinkForm['status'] }))}
              className="w-full px-3 py-1.5 rounded-xl bg-transparent border outline-none text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <option value="approved">已通过</option>
              <option value="pending">待审核</option>
              <option value="rejected">已拒绝</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={createForm.showInSidebar} onChange={e => setCreateForm(v => ({ ...v, showInSidebar: e.target.checked }))} />
              在右侧栏显示
            </label>
            <button onClick={handleCreate} disabled={creating}
              className="w-full px-4 py-1.5 rounded-xl text-white text-sm font-medium disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              {creating ? '创建中...' : '新增友链'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
