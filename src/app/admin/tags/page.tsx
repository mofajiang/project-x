'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'

interface Tag { id: string; name: string; slug: string; _count: { posts: number } }

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    fetch('/api/admin/tags')
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
      <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>🏷 标签管理</h1>
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
