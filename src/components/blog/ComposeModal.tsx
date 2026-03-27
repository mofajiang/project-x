'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { useTheme } from '@/hooks/useTheme'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  avatar?: string | null
  username: string
}

export function ComposeModal({ avatar, username }: Props) {
  const router = useRouter()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [useMarkdown, setUseMarkdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // 监听全局事件打开弹窗
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-compose', handler)
    return () => window.removeEventListener('open-compose', handler)
  }, [])

  // 打开后聚焦
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80)
  }, [open])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleClose = useCallback(() => {
    setOpen(false)
    setContent('')
    setTitle('')
    setUseMarkdown(false)
  }, [])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) { toast.error('内容不能为空'); return }
    const postTitle = title.trim() || trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : '')
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
          tags: [],
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('发布成功')
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
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', paddingTop: 'max(5vh, 48px)' }}
      onMouseDown={e => { if (e.target === backdropRef.current) handleClose() }}
    >
      <div
        className="w-full mx-4 rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxWidth: 600,
          background: 'var(--bg)',
          border: '0.5px solid var(--border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <button
            className="text-xs px-3 py-1 rounded-full font-semibold transition-colors"
            style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
            onClick={() => { handleClose(); router.push('/admin/posts/new') }}
          >
            完整编辑器
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex gap-3 px-4 pb-3">
          {/* 头像 */}
          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-base mt-1"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {avatar
              ? <img src={avatar} alt={username} className="w-full h-full object-cover" />
              : <span>{username[0]?.toUpperCase()}</span>}
          </div>

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* 标题 */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="标题（留空自动生成）"
              className="w-full px-0 py-1 text-sm outline-none bg-transparent border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)', caretColor: 'var(--accent)' }}
            />

            {/* 正文 */}
            {useMarkdown ? (
              <div data-color-mode={theme}>
                <MDEditor
                  value={content}
                  onChange={v => setContent(v || '')}
                  height={260}
                  preview="edit"
                  style={{ background: 'transparent', borderRadius: 8 }}
                />
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="有什么新鲜事？"
                rows={6}
                className="w-full resize-none outline-none bg-transparent text-[17px] leading-relaxed placeholder:text-[var(--text-secondary)]"
                style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
              />
            )}

            {/* 分割线 */}
            <div style={{ height: '0.5px', background: 'var(--border)' }} />

            {/* 底部工具栏 */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setUseMarkdown(v => !v)}
                  title={useMarkdown ? '切换为纯文本' : '切换为 Markdown 编辑器'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={{
                    color: useMarkdown ? 'var(--accent)' : 'var(--text-secondary)',
                    background: useMarkdown ? 'rgba(29,155,240,0.1)' : 'transparent',
                    border: `1px solid ${useMarkdown ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  MD
                </button>
              </div>

              <div className="flex items-center gap-2">
                {content.length > 0 && (
                  <span className="text-xs tabular-nums" style={{ color: content.length > 500 ? '#F4212E' : 'var(--text-secondary)' }}>
                    {content.length}
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !content.trim()}
                  className="px-5 py-1.5 rounded-full text-sm font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90 active:scale-95"
                  style={{ background: 'var(--accent)' }}
                >
                  {submitting ? '发布中...' : '发布'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
