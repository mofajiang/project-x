'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { TipTapEditor } from '@/components/admin/TipTapEditor'
import { StorageImagePicker } from '@/components/admin/StorageImagePicker'
import { VoiceInput } from '@/components/admin/VoiceInput'
import { PostPolish } from '@/components/admin/PostPolish'
import { IMEInput } from '@/components/ui/IMEInput'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  const DRAFT_KEY = `post-draft-${params.id}`

  const [form, setForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    coverImage: '',
    published: false,
    tags: '',
    pinned: false,
    publishedAt: '',
    threadId: '',
    threadOrder: 1,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [threads, setThreads] = useState<{ threadId: string; count: number; firstTitle: string; nextOrder: number }[]>(
    []
  )
  const [showThreadPicker, setShowThreadPicker] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  // 自动保存草稿到 localStorage
  const scheduleDraftSave = useCallback(
    (newForm: typeof form) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newForm))
        setHasDraft(true)
      }, 2000)
    },
    [DRAFT_KEY]
  )

  const updateForm = useCallback(
    (updater: (f: typeof form) => typeof form) => {
      setForm((prev) => {
        const next = updater(prev)
        scheduleDraftSave(next)
        return next
      })
    },
    [scheduleDraftSave]
  )

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/posts/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
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
              threadId: data.threadId || '',
              threadOrder: data.threadOrder ?? 1,
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
        try {
          setForm(JSON.parse(saved))
          setHasDraft(true)
        } catch {}
      }
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [isNew, params.id, DRAFT_KEY])

  // 加载已有 Thread 列表
  useEffect(() => {
    fetch('/api/admin/threads')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setThreads(data)
      })
      .catch(() => {})
  }, [])

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setHasDraft(false)
  }

  const save = async (publish?: boolean) => {
    setSaving(true)
    const tagsArr = form.tags
      .split(/[，,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const body = {
      ...form,
      published: publish !== undefined ? publish : form.published,
      tags: tagsArr,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      threadId: form.threadId.trim() || null,
      threadOrder: form.threadOrder,
    }
    const url = isNew ? '/api/admin/posts' : `/api/admin/posts/${params.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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
    if (data.url) updateForm((f) => ({ ...f, coverImage: data.url }))
  }

  const uploadImageForTipTap = async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.url) throw new Error(data?.error || '上传失败')
    return data.url
  }

  const charCount = useMemo(() => {
    const text = form.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '')
    return text.length
  }, [form.content])

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <h1 className={`${ADMIN_PAGE_TITLE_CLASS} text-xl sm:text-3xl`} style={{ color: 'var(--text-primary)' }}>
            {isNew ? '新建文章' : '编辑文章'}
          </h1>
          <button
            type="button"
            onClick={() => updateForm((f) => ({ ...f, pinned: !f.pinned }))}
            title={form.pinned ? '已置顶，点击取消' : '点击置顶此文章'}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
            style={{
              background: form.pinned ? 'rgba(29,155,240,0.12)' : 'transparent',
              color: form.pinned ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${form.pinned ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            📌 {form.pinned ? '已置顶' : '置顶'}
          </button>
        </div>
        {hasDraft && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span style={{ color: 'var(--accent)' }}>● 有未保存的本地草稿</span>
            <button
              onClick={() => {
                const saved = localStorage.getItem(DRAFT_KEY)
                if (saved) {
                  try {
                    setForm(JSON.parse(saved))
                  } catch {}
                }
              }}
              className="underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              恢复
            </button>
            <button onClick={clearDraft} className="underline" style={{ color: 'var(--text-secondary)' }}>
              丢弃
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5 sm:space-y-6">
          <section
            className="rounded-2xl p-4 sm:p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <label className="mb-2 block text-xs font-medium sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              文章标题 *
            </label>
            <IMEInput
              type="text"
              placeholder="输入文章标题..."
              value={form.title}
              onValueChange={(v) => updateForm((f) => ({ ...f, title: v }))}
              className="w-full border-b-2 bg-transparent py-2 text-lg font-bold outline-none transition-colors sm:text-2xl"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
          </section>

          <section
            className="rounded-2xl p-4 sm:p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <label className="mb-2 block text-xs font-medium sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              摘要
            </label>
            <IMEInput
              type="text"
              placeholder="（可选）简短描述此文章"
              value={form.excerpt}
              onValueChange={(v) => updateForm((f) => ({ ...f, excerpt: v }))}
              className="w-full border-b bg-transparent py-2 text-sm outline-none"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
          </section>

          <section
            className="rounded-2xl p-4 sm:p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-medium sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                正文内容 *
              </label>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                共 {charCount.toLocaleString()} 字
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StorageImagePicker
                buttonText="从云存储插入图片"
                onSelect={(url) => {
                  updateForm((f) => ({ ...f, content: f.content + `<img src="${url}" alt="图片" />` }))
                  toast.success('已插入云存储图片')
                }}
                className="rounded-lg px-4 py-2 text-xs font-medium sm:rounded-full sm:text-sm"
              />
              <VoiceInput
                onInsertContent={(text) => {
                  updateForm((f) => ({ ...f, content: f.content + `<p>${text}</p>` }))
                }}
              />{' '}
              <PostPolish
                content={form.content}
                onApply={(polished) => updateForm((f) => ({ ...f, content: polished }))}
              />{' '}
            </div>
            <TipTapEditor
              value={form.content}
              onChange={(v) => updateForm((f) => ({ ...f, content: v }))}
              onImageUpload={uploadImageForTipTap}
            />
          </section>

          <section
            className="rounded-lg p-3 sm:p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <p className="mb-2 text-[10px] font-medium sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
              � 提示：可粘贴图片快速插入，支持 Markdown 语法快捷键（如 **粗体**、# 标题等）
            </p>
          </section>
        </main>

        <aside className="h-fit space-y-4 lg:sticky lg:top-3">
          <section
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              发布
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                保存草稿
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {saving ? '保存中...' : '立即发布'}
              </button>
            </div>
          </section>

          <section
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              文章设置
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  标签
                </label>
                <IMEInput
                  type="text"
                  placeholder="逗号分隔，如：Rust, 教程"
                  value={form.tags}
                  onValueChange={(v) => updateForm((f) => ({ ...f, tags: v }))}
                  className="x-admin-input w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  发布时间
                </label>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => updateForm((f) => ({ ...f, publishedAt: e.target.value }))}
                  className="x-admin-input w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  留空即使用当前时间
                </p>
              </div>

              <button
                type="button"
                onClick={() => updateForm((f) => ({ ...f, pinned: !f.pinned }))}
                className="flex w-full items-center justify-between rounded-full px-3 py-2 text-xs font-medium transition-all"
                style={{
                  background: form.pinned ? 'rgba(29,155,240,0.12)' : 'var(--bg)',
                  color: form.pinned ? 'var(--accent)' : 'var(--text-secondary)',
                  border: `1px solid ${form.pinned ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <span>📌 置顶此文章</span>
                <span>{form.pinned ? '✓ 已置顶' : '未置顶'}</span>
              </button>
            </div>
          </section>

          <section
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              封面图
            </h2>
            <div className="flex flex-col gap-2">
              <StorageImagePicker
                onSelect={(url) => {
                  updateForm((f) => ({ ...f, coverImage: url }))
                  toast.success('已选择云存储图片')
                }}
                onLocalClick={() => coverInputRef.current?.click()}
                localLoading={uploading}
                localButtonText="选择封面图"
              />
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
              {form.coverImage && (
                <div className="relative h-36 rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                  <Image src={form.coverImage} alt="封面预览" fill className="rounded object-cover" unoptimized />
                </div>
              )}
            </div>
          </section>

          {/* Thread 设置 */}
          <section
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Thread 设置
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Thread ID
                </label>
                <div className="flex gap-1">
                  <IMEInput
                    type="text"
                    placeholder="留空则不属于任何 Thread"
                    value={form.threadId}
                    onValueChange={(v) => updateForm((f) => ({ ...f, threadId: v }))}
                    className="x-admin-input min-w-0 flex-1 rounded-xl border bg-transparent px-2 py-1.5 text-xs outline-none"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const id = crypto.randomUUID()
                      updateForm((f) => ({ ...f, threadId: id, threadOrder: 1 }))
                      setShowThreadPicker(false)
                    }}
                    className="flex-shrink-0 rounded-full px-2 py-1.5 text-xs transition-colors hover:opacity-80"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                    title="生成新 Thread ID"
                  >
                    新建
                  </button>
                  {form.threadId.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        updateForm((f) => ({ ...f, threadId: '', threadOrder: 1 }))
                        setShowThreadPicker(false)
                      }}
                      className="flex-shrink-0 rounded-full px-2 py-1.5 text-xs transition-colors hover:opacity-80"
                      style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                      title="移出 Thread"
                    >
                      清除
                    </button>
                  )}
                </div>
                {/* 从已有 Thread 选择 */}
                {threads.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowThreadPicker((v) => !v)}
                      className="text-xs underline-offset-2 hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {showThreadPicker ? '▲ 收起' : '▼ 从已有 Thread 选择'}
                    </button>
                    {showThreadPicker && (
                      <div
                        className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg p-1"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                      >
                        {threads.map((t) => (
                          <button
                            key={t.threadId}
                            type="button"
                            onClick={() => {
                              updateForm((f) => ({ ...f, threadId: t.threadId, threadOrder: t.nextOrder }))
                              setShowThreadPicker(false)
                            }}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5"
                            style={{
                              outline: form.threadId === t.threadId ? '1px solid var(--accent)' : 'none',
                              background: form.threadId === t.threadId ? 'rgba(29,155,240,0.08)' : 'transparent',
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                              {t.firstTitle}
                            </span>
                            <span className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                              {t.count} 条
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  同一 Thread ID 的帖子会串联展示
                </p>
              </div>
              {form.threadId.trim() && (
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Thread 内顺序
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.threadOrder}
                    onChange={(e) => updateForm((f) => ({ ...f, threadOrder: parseInt(e.target.value) || 1 }))}
                    className="x-admin-input w-full rounded-xl border bg-transparent px-2 py-1.5 text-xs outline-none"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    已有 Thread 中下一序号已自动填入
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
