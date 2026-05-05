'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ADMIN_CARD_CLASS,
  ADMIN_TABLE_CLASS,
  ADMIN_PAGE_WRAPPER,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_INPUT_CLASS,
  ADMIN_BTN_PRIMARY,
  ADMIN_EMPTY_CLASS,
} from '@/components/admin/adminUi'
import { getErrorMessage } from '@/lib/converters'

interface Tag {
  id: string
  name: string
  slug: string
  _count: { posts: number }
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTags(data)
      })
      .catch(() => {})
  }, [])

  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`删除标签「${name}」？关联文章不会删除`)) return
    await fetch('/api/admin/tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTags((t) => t.filter((x) => x.id !== id))
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
      setTags((prev) => {
        const next = prev.filter((tag) => tag.id !== data.id)
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
    <div
      key={tag.id}
      className={`${ADMIN_CARD_CLASS} flex items-center justify-between gap-3`}
      style={{ background: 'var(--bg-hover)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--accent)' }}>
          #{tag.name}
        </p>
        <p className="mt-1 break-all text-xs" style={{ color: 'var(--text-secondary)' }}>
          {tag.slug}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          文章数：{tag._count.posts}
        </p>
      </div>
      <button
        onClick={() => deleteTag(tag.id, tag.name)}
        className="shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors hover:opacity-80"
        style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
      >
        删除
      </button>
    </div>
  )

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>
        标签管理
      </h1>
      <div
        className="sticky top-0 z-20 -mx-1 mb-4 flex items-center justify-end gap-3 rounded-2xl px-3 py-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createTag()
              }
            }}
            placeholder="输入新标签名"
            className={ADMIN_INPUT_CLASS + ' w-36 sm:w-48'}
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <button
            type="button"
            onClick={createTag}
            disabled={saving}
            className={ADMIN_BTN_PRIMARY}
            style={{ background: 'var(--accent)' }}
          >
            {saving ? '创建中...' : '新增'}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:hidden">{tags.map(renderTagCard)}</div>

      <div className="hidden overflow-hidden rounded-2xl sm:block" style={{ background: 'var(--bg-secondary)' }}>
        <table className={ADMIN_TABLE_CLASS}>
          <thead>
            <tr>
              <th>标签名</th>
              <th>Slug</th>
              <th>文章数</th>
              <th style={{ textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td className="font-medium" style={{ color: 'var(--accent)' }}>
                  #{tag.name}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{tag.slug}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{tag._count.posts}</td>
                <td className="text-center">
                  <button
                    onClick={() => deleteTag(tag.id, tag.name)}
                    className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                    style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tags.length === 0 && (
          <div className={ADMIN_EMPTY_CLASS} style={{ color: 'var(--text-secondary)' }}>
            <p>暂无标签</p>
          </div>
        )}
      </div>
    </div>
  )
}
