'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { useTheme } from '@/hooks/useTheme'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  avatar?: string | null
  username: string
}

export function QuickPost({ avatar, username }: Props) {
  const router = useRouter()
  const theme = useTheme()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [useMarkdown, setUseMarkdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      setContent('')
      setTitle('')
      setFocused(false)
      setUseMarkdown(false)
      router.refresh()
    } catch {
      toast.error('发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      {/* 头像 */}
      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-base"
        style={{ background: 'var(--accent)', color: '#fff' }}>
        {avatar
          ? <img src={avatar} alt={username} className="w-full h-full object-cover" />
          : <span>{username[0]?.toUpperCase()}</span>}
      </div>

      {/* 输入区 */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* 可选标题（展开后显示） */}
        {focused && (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="标题（留空自动生成）"
            className="w-full px-0 py-1 text-sm outline-none bg-transparent border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)', caretColor: 'var(--accent)' }}
          />
        )}

        {/* 正文 */}
        {useMarkdown ? (
          <div data-color-mode={theme}>
            <MDEditor
              value={content}
              onChange={v => setContent(v || '')}
              height={200}
              preview="edit"
              style={{ background: 'transparent', borderRadius: 8 }}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="有什么新鲜事？"
            rows={focused ? 3 : 1}
            className="w-full resize-none outline-none bg-transparent text-[17px] leading-relaxed placeholder:text-[var(--text-secondary)]"
            style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
          />
        )}

        {/* 底部工具栏（展开后显示） */}
        {focused && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              {/* Markdown 切换 */}
              <button
                onClick={() => setUseMarkdown(v => !v)}
                title={useMarkdown ? '切换为纯文本' : '切换为 Markdown 编辑器'}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  color: useMarkdown ? 'var(--accent)' : 'var(--text-secondary)',
                  background: useMarkdown ? 'rgba(29,155,240,0.1)' : 'transparent',
                  border: `1px solid ${useMarkdown ? 'var(--accent)' : 'var(--border)'}`,
                }}>
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
              {/* 字数 */}
              {content.length > 0 && (
                <span className="text-xs" style={{ color: content.length > 500 ? '#F4212E' : 'var(--text-secondary)' }}>
                  {content.length}
                </span>
              )}
              {/* 取消 */}
              <button
                onClick={() => { setFocused(false); setContent(''); setTitle(''); setUseMarkdown(false) }}
                className="px-3 py-1 rounded-full text-sm font-bold transition-colors"
                style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                取消
              </button>
              {/* 发布 */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !content.trim()}
                className="px-4 py-1 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}>
                {submitting ? '发布中...' : '发布'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
