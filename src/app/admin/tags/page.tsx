'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

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
    if (!confirm(`删除标签�?{name}」？关联文章不会删除`)) return
    await fetch('/api/admin/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTags(t => t.filter(x => x.id !== id))
    toast.success('已删�?)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>🏷 标签管理</h1>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th className="text-left px-4 py-3">标签�?/th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-left px-4 py-3">文章�?/th>
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
        {tags.length === 0 && <p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>暂无标签，在文章编辑中添加后自动创建</p>}
      </div>
    </div>
  )
}
