'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { useTheme } from '@/hooks/useTheme'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

const DRAFT_KEY = 'compose-draft'

interface Props {
  avatar?: string | null
  username: string
}

export function ComposeModal({ avatar, username }: Props) {
  const router = useRouter()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false) // 控制滑入动画
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [useMarkdown, setUseMarkdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 恢复草稿
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const { title: t, content: c, tags: tg } = JSON.parse(saved)
        if (t) setTitle(t)
        if (c) setContent(c)
        if (tg) setTags(tg)
      }
    } catch {}
  }, [])

  // 自动保存草稿
  useEffect(() => {
    if (!content && !title && !tags) return
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, tags }))
    }, 1000)
    return () => clearTimeout(t)
  }, [title, content, tags])

  // 监听全局事件打开弹窗
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ quoteSlug?: string }>).detail
      if (detail?.quoteSlug) {
        setContent(`::quote[${detail.quoteSlug}]\n`)
        setTitle('')
      }
      setOpen(true)
      setTimeout(() => setVisible(true), 10)
    }
    window.addEventListener('open-compose', handler)
    return () => window.removeEventListener('open-compose', handler)
  }, [])

  // 打开后聚焦
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 300)
  }, [open])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setOpen(false)
    }, 280)
  }, [])

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY)

  // 上传图片并插入链接
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        const imgMd = `\n![图片](${data.url})\n`
        setContent((prev) => prev + imgMd)
        toast.success('图片已插入')
      }
    } catch {
      toast.error('图片上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      toast.error('内容不能为空')
      return
    }
    const postTitle = title.trim() || trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : '')
    const tagsArr = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postTitle,
          content: trimmed,
          excerpt: trimmed.slice(0, 120),
          published: true,
          tags: tagsArr,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('发布成功')
      clearDraft()
      setTitle('')
      setContent('')
      setTags('')
      handleClose()
      router.refresh()
    } catch {
      toast.error('发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center"
      style={{ background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)', transition: 'background 0.28s' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* 隐藏文件输入 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <div
        ref={sheetRef}
        className="flex w-full flex-col overflow-hidden rounded-t-2xl md:mx-4 md:rounded-2xl"
        style={{
          maxWidth: 600,
          background: 'var(--bg)',
          border: '0.5px solid var(--border)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.4)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '92dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 拖拽指示条 */}
        <div className="flex justify-center pb-1 pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <button
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
            onClick={() => {
              handleClose()
              router.push('/admin/posts/new')
            }}
          >
            完整编辑器
          </button>
        </div>

        {/* 内容区（可滚动） */}
        <div className="flex flex-1 gap-3 overflow-y-auto px-4 pb-2">
          {/* 头像 */}
          <div
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {avatar ? (
              <img src={avatar} alt={username} className="h-full w-full object-cover" />
            ) : (
              <span>{username[0]?.toUpperCase()}</span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* 标题 */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（留空自动生成）"
              className="w-full border-b bg-transparent px-0 py-1 text-sm outline-none"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)', caretColor: 'var(--accent)' }}
            />

            {/* 正文 */}
            {useMarkdown ? (
              <div data-color-mode={theme}>
                <MDEditor
                  value={content}
                  onChange={(v) => setContent(v || '')}
                  height={window.innerHeight < 700 ? 140 : 220}
                  preview="edit"
                  style={{ background: 'transparent', borderRadius: 8 }}
                />
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="有什么新鲜事？"
                rows={5}
                className="w-full resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-[var(--text-secondary)]"
                style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)', minHeight: 100 }}
              />
            )}

            {/* 标签 */}
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="标签（逗号分隔，如：随笔, 生活）"
              className="w-full border-b bg-transparent px-0 py-1 text-xs outline-none"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', caretColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* 底部工具栏（固定） */}
        <div className="flex items-center justify-between border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1">
            {/* 图片上传 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="插入图片"
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {uploading ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-spin"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </button>
            {/* MD 切换 */}
            <button
              onClick={() => setUseMarkdown((v) => !v)}
              title={useMarkdown ? '切换为纯文本' : '切换为 Markdown'}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                color: useMarkdown ? 'var(--accent)' : 'var(--text-secondary)',
                background: useMarkdown ? 'rgba(29,155,240,0.1)' : 'transparent',
                border: `1px solid ${useMarkdown ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              MD
            </button>
          </div>

          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span
                className="text-xs tabular-nums"
                style={{ color: content.length > 500 ? '#F4212E' : 'var(--text-secondary)' }}
              >
                {content.length}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="rounded-full px-5 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--accent)', transition: 'transform 0.1s' }}
            >
              {submitting ? '发布中...' : '发布'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
