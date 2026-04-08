'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/converters'
import { MarkdownEditor } from '@/components/admin/MarkdownEditor'
import { StorageImagePicker } from '@/components/admin/StorageImagePicker'
import { IMEInput } from '@/components/ui/IMEInput'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  const DRAFT_KEY = `post-draft-${params.id}`

  const [form, setForm] = useState({
    title: '', content: '', excerpt: '', coverImage: '', published: false, tags: '', pinned: false, publishedAt: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

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
            publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString().slice(0, 16) : '',
            tags: (data.tags || []).map((t: { tag: { name: string } }) => t.tag.name).join(', '),
            pinned: data.pinned || false,
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
    const tagsArr = form.tags
      .split(/[，,]+/)
      .map(t => t.trim())
      .filter(Boolean)
    const body = { 
      ...form, 
      published: publish !== undefined ? publish : form.published, 
      tags: tagsArr,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    }
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

  const uploadBodyImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadingBodyImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error || '上传失败')

      updateForm(f => {
        const prefix = f.content && !f.content.endsWith('\n') ? '\n' : ''
        return { ...f, content: `${f.content}${prefix}\n![图片](${data.url})\n` }
      })
      toast.success('图片已插入正文')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '图片上传失败')
    } finally {
      setUploadingBodyImage(false)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className={`${ADMIN_PAGE_TITLE_CLASS} text-xl sm:text-3xl`} style={{ color: 'var(--text-primary)' }}>
          {isNew ? '新建文章' : '编辑文章'}
        </h1>
        {hasDraft && (
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
            <span style={{ color: 'var(--accent)' }}>● 有未保存的本地草稿</span>
            <button onClick={() => { const saved = localStorage.getItem(DRAFT_KEY); if (saved) { try { setForm(JSON.parse(saved)) } catch {} } }} className="underline" style={{ color: 'var(--text-secondary)' }}>恢复</button>
            <button onClick={clearDraft} className="underline" style={{ color: 'var(--text-secondary)' }}>丢弃</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-6">
        <main className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              文章标题 *
            </label>
            <IMEInput
              type="text" placeholder="输入文章标题..."
              value={form.title} onValueChange={v => updateForm(f => ({ ...f, title: v }))}
              className="w-full text-lg sm:text-2xl font-bold bg-transparent outline-none border-b-2 py-2 transition-colors"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
          </section>

          <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              摘要
            </label>
            <IMEInput
              type="text" placeholder="（可选）简短描述此文章"
              value={form.excerpt} onValueChange={v => updateForm(f => ({ ...f, excerpt: v }))}
              className="w-full bg-transparent outline-none py-2 text-sm border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
          </section>

          <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <label className="block text-xs sm:text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              正文内容 - Markdown / GFM *
            </label>
            <div className="mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => bodyImageInputRef.current?.click()}
                  disabled={uploadingBodyImage}
                  className="px-4 py-2 rounded-lg sm:rounded-full text-xs sm:text-sm font-medium disabled:opacity-60"
                  style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                >
                  {uploadingBodyImage ? '上传中...' : '上传正文图片并插入'}
                </button>
                <StorageImagePicker
                  buttonText="从云存储插入"
                  onSelect={(url) => {
                    updateForm(f => {
                      const prefix = f.content && !f.content.endsWith('\n') ? '\n' : ''
                      return { ...f, content: `${f.content}${prefix}\n![图片](${url})\n` }
                    })
                    toast.success('已插入云存储图片')
                  }}
                  className="px-4 py-2 rounded-lg sm:rounded-full text-xs sm:text-sm font-medium"
                />
              </div>
              <input
                ref={bodyImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadBodyImage}
              />
            </div>
            <MarkdownEditor
              value={form.content}
              onChange={v => updateForm(f => ({ ...f, content: v }))}
            />
          </section>

          <section className="p-3 sm:p-4 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] sm:text-xs mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              📝 支持语法：
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div>**粗体** / *斜体* / `代码`</div>
              <div># 标题 / - 列表 / &gt; 引用</div>
              <div>[链接](url) / ![图片](url)</div>
              <div>::quote[slug] / ::quote-url[url]</div>
            </div>
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-3 h-fit">
          <section className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>发布</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => save(false)} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                保存草稿
              </button>
              <button onClick={() => save(true)} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {saving ? '保存中...' : '立即发布'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>文章设置</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>标签</label>
                <IMEInput
                  type="text" placeholder="逗号分隔，如：Rust, 教程"
                  value={form.tags} onValueChange={v => updateForm(f => ({ ...f, tags: v }))}
                  className="w-full bg-transparent outline-none py-2 text-sm border rounded-lg px-3"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>发布时间</label>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={e => updateForm(f => ({ ...f, publishedAt: e.target.value }))}
                  className="w-full bg-transparent outline-none py-2 text-sm border rounded-lg px-3"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  留空即使用当前时间
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={e => updateForm(f => ({ ...f, pinned: e.target.checked }))}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  置顶此文章
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>封面图</h2>
            <div className="flex flex-col gap-2">
              <StorageImagePicker
                onSelect={(url) => {
                  updateForm(f => ({ ...f, coverImage: url }))
                  toast.success('已选择云存储图片')
                }}
                onLocalClick={() => coverInputRef.current?.click()}
                localLoading={uploading}
                localButtonText="选择封面图"
              />
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
              {form.coverImage && (
                <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.coverImage} alt="封面预览" className="w-full h-36 rounded object-cover" />
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
