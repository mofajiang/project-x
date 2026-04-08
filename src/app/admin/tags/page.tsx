'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'
import { getErrorMessage } from '@/lib/converters';

interface Tag { id: string; name: string; slug: string; _count: { posts: number } }

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/tags', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTags(data) })
      .catch(() => {})
  }, [])

  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`删除标签「${name}」？关联文章不会删除`)) return
    await fetch('/api/admin/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTags(t => t.filter(x => x.id !== id))
    toast.success('已删除')
  }

  const createTag = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('请输入标签名')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '创建失败')
      setTags(prev => {
        const next = prev.filter(tag => tag.id !== data.id)
        return [data, ...next]
      })
      setName('')
      toast.success('标签已创建')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const renderTagCard = (tag: Tag) => (
    <div key={tag.id} className={`${ADMIN_CARD_CLASS} flex items-center justify-between gap-3`} style={{ background: 'var(--bg-hover)' }}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate" style={{ color: 'var(--accent)' }}>#{tag.name}</p>
        <p className="text-xs mt-1 break-all" style={{ color: 'var(--text-secondary)' }}>{tag.slug}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>文章数：{tag._count.posts}</p>
      </div>
      <button onClick={() => deleteTag(tag.id, tag.name)}
        className="px-3 py-2 rounded-full text-xs font-bold transition-colors hover:opacity-80 shrink-0"
        style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>删除</button>
    </div>
  )

  return (
    <div>
      <div className="sticky top-0 z-20 flex items-center justify-end gap-3 px-3 py-2 rounded-2xl mb-4 -mx-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createTag()
              }
            }}
            placeholder="输入新标签名"
            className="w-36 sm:w-48 px-3 py-1.5 rounded-full text-sm outline-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <button
            type="button"
            onClick={createTag}
            disabled={saving}
            className="px-4 py-1.5 rounded-full text-sm font-bold text-white disabled:opacity-50 shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? '创建中...' : '新增'}
          </button>
        </div>
      </div>
      <div className="sm:hidden flex flex-col gap-3">
        {tags.map(renderTagCard)}
      </div>

      <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th className="text-left px-4 py-3">标签名</th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-left px-4 py-3">文章数</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {tags.map(tag => (
              <tr key={tag.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--accent)' }}>#{tag.name}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{tag.slug}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{tag._count.posts}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => deleteTag(tag.id, tag.name)}
                    className="px-3 py-1 rounded-full text-xs font-bold transition-colors hover:opacity-80"
                    style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tags.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
            <p>暂无标签</p>
          </div>
        )}
      </div>
    </div>
  )
}
