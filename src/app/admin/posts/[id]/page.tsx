'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { MarkdownEditor } from '@/components/admin/MarkdownEditor'
import { IMEInput } from '@/components/ui/IMEInput'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  const DRAFT_KEY = `post-draft-${params.id}`

  const [form, setForm] = useState({
    title: '', content: '', excerpt: '', coverImage: '', published: false, tags: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 自动保存草稿到 localStorage
  const scheduleDraftSave = useCallback((newForm: typeof form) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newForm))
      setHasDraft(true)
    }, 2000)
  }, [DRAFT_KEY])

  const updateForm = useCallback((updater: (f: typeof form) => typeof form) => {
    setForm(prev => {
      const next = updater(prev)
      scheduleDraftSave(next)
      return next
    })
  }, [scheduleDraftSave])

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/posts/${params.id}`).then(r => r.json()).then(data => {
        if (data) {
          const serverForm = {
            title: data.title || '',
            content: data.content || '',
            excerpt: data.excerpt || '',
            coverImage: data.coverImage || '',
            published: data.published || false,
            tags: (data.tags || []).map((t: { tag: { name: string } }) => t.tag.name).join(', '),
          }
          // 检查是否有未保存的草稿
          const saved = localStorage.getItem(DRAFT_KEY)
          if (saved) {
            try {
              const draft = JSON.parse(saved)
              setForm(draft)
              setHasDraft(true)
            } catch {
              setForm(serverForm)
            }
          } else {
            setForm(serverForm)
          }
        }
      })
    } else {
      // 新建文章也检查草稿
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        try { setForm(JSON.parse(saved)); setHasDraft(true) } catch {}
      }
    }
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [isNew, params.id, DRAFT_KEY])

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setHasDraft(false)
  }

  const save = async (publish?: boolean) => {
    setSaving(true)
    const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const body = { ...form, published: publish !== undefined ? publish : form.published, tags: tagsArr }
    const url = isNew ? '/api/admin/posts' : `/api/admin/posts/${params.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) {
      clearDraft()
      toast.success(isNew ? '文章已创建' : '已保存')
      if (isNew) router.push('/admin/posts')
    } else {
      toast.error('保存失败')
    }
  }

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (data.url) updateForm(f => ({ ...f, coverImage: data.url }))
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>
            {isNew ? '新建文章' : '编辑文章'}
          </h1>
          {hasDraft && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs" style={{ color: 'var(--accent)' }}>● 有未保存的本地草稿</span>
              <button onClick={() => { const saved = localStorage.getItem(DRAFT_KEY); if (saved) { try { setForm(JSON.parse(saved)) } catch {} } }} className="text-xs underline" style={{ color: 'var(--text-secondary)' }}>恢复</button>
              <button onClick={clearDraft} className="text-xs underline" style={{ color: 'var(--text-secondary)' }}>丢弃</button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={() => save(false)} disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50 w-full sm:w-auto"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            保存草稿
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50 w-full sm:w-auto"
            style={{ background: 'var(--accent)' }}>
            {saving ? '保存中...' : '发布'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 标题 */}
        <IMEInput
          type="text" placeholder="文章标题"
          value={form.title} onValueChange={v => updateForm(f => ({ ...f, title: v }))}
          className="w-full text-2xl font-bold bg-transparent outline-none border-b py-2"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
        />

        {/* 摘要 */}
        <IMEInput
          type="text" placeholder="摘要（可选）"
          value={form.excerpt} onValueChange={v => updateForm(f => ({ ...f, excerpt: v }))}
          className="w-full bg-transparent outline-none py-2 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        />

        {/* 标签 */}
        <IMEInput
          type="text" placeholder="标签（逗号分隔，如：Rust, 后端, 教程）"
          value={form.tags} onValueChange={v => updateForm(f => ({ ...f, tags: v }))}
          className="w-full bg-transparent outline-none py-2 text-sm border rounded-xl px-3"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
        />

        {/* 封面图 */}
        <div className="flex items-center gap-3">
          <label className="px-3 py-1.5 rounded-full text-sm cursor-pointer"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {uploading ? '上传中...' : '上传封面图'}
            <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
          </label>
          {form.coverImage && <span className="text-sm" style={{ color: 'var(--accent)' }}>✓ 已设置</span>}
        </div>

        {/* Markdown 编辑器 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>正文</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border)' }}>Markdown / GFM</span>
          </div>
          <MarkdownEditor
            value={form.content}
            onChange={v => updateForm(f => ({ ...f, content: v }))}
          />
        </div>
        <p className="text-xs pb-2" style={{ color: 'var(--text-secondary)' }}>
          支持 **粗体** *斜体* `代码` ``` 代码块 ``` # 标题 - 列表 &gt; 引用 [链接](url) ![图片](url)
        </p>
        <p className="text-xs pb-2" style={{ color: 'var(--text-secondary)' }}>
          引用语法：站内文章 <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 4 }}>::quote[文章slug]</code>　外部链接 <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 4 }}>::quote-url[https://... "标题" "描述"]</code>
        </p>
      </div>
    </div>
  )
}
