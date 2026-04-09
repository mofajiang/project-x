'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  content: string
  onApply: (polished: string) => void
}

export function PostPolish({ content, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [polishedText, setPolishedText] = useState('')
  const [view, setView] = useState<'result' | 'diff'>('result')

  const handlePolish = async () => {
    if (!content.trim()) {
      toast.error('文章内容为空，请先编写内容')
      return
    }
    if (content.length > 20000) {
      toast.error('文章过长（超过 20000 字），请分段润色')
      return
    }
    setPolishing(true)
    setPolishedText('')
    try {
      const res = await fetch('/api/admin/post-polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (res.ok && data.polished) {
        setPolishedText(data.polished)
        setOpen(true)
      } else {
        toast.error(data.error || 'AI 润色失败')
      }
    } catch {
      toast.error('AI 润色失败')
    } finally {
      setPolishing(false)
    }
  }

  const handleApply = () => {
    onApply(polishedText)
    setOpen(false)
    toast.success('已应用润色结果')
  }

  // 简单逐行对比，高亮不同的行
  const diffLines = () => {
    const orig = content.split('\n')
    const pols = polishedText.split('\n')
    const maxLen = Math.max(orig.length, pols.length)
    return Array.from({ length: maxLen }, (_, i) => ({
      orig: orig[i] ?? '',
      pol: pols[i] ?? '',
      changed: (orig[i] ?? '') !== (pols[i] ?? ''),
    }))
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePolish}
        disabled={polishing}
        className="rounded-lg px-4 py-2 text-xs font-medium transition-opacity disabled:opacity-60 sm:rounded-full sm:text-sm"
        style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        {polishing ? '润色中...' : '✨ AI 润色'}
      </button>

      {open && polishedText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl shadow-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            {/* 标题栏 */}
            <div
              className="flex shrink-0 items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                ✨ AI 润色结果
              </h3>
              <div className="flex items-center gap-2">
                {/* 视图切换 */}
                <div className="flex overflow-hidden rounded-lg text-xs" style={{ border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setView('result')}
                    className="px-3 py-1.5 transition-colors"
                    style={{
                      background: view === 'result' ? 'var(--accent)' : 'transparent',
                      color: view === 'result' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    润色结果
                  </button>
                  <button
                    onClick={() => setView('diff')}
                    className="px-3 py-1.5 transition-colors"
                    style={{
                      background: view === 'diff' ? 'var(--accent)' : 'transparent',
                      color: view === 'diff' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    逐行对比
                  </button>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 内容区 */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {view === 'result' ? (
                <pre
                  className="whitespace-pre-wrap font-sans text-sm leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {polishedText}
                </pre>
              ) : (
                <div className="space-y-1">
                  <div
                    className="mb-2 grid grid-cols-2 gap-2 text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span>原文</span>
                    <span>润色后</span>
                  </div>
                  {diffLines().map((line, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 gap-2 rounded-lg p-1.5 text-xs"
                      style={{
                        background: line.changed ? 'rgba(29,155,240,0.06)' : 'transparent',
                      }}
                    >
                      <pre
                        className="whitespace-pre-wrap font-sans leading-relaxed"
                        style={{
                          color: line.changed ? '#ef4444' : 'var(--text-secondary)',
                          opacity: line.changed ? 1 : 0.5,
                        }}
                      >
                        {line.orig || ' '}
                      </pre>
                      <pre
                        className="whitespace-pre-wrap font-sans leading-relaxed"
                        style={{
                          color: line.changed ? 'var(--accent)' : 'var(--text-secondary)',
                          opacity: line.changed ? 1 : 0.5,
                        }}
                      >
                        {line.pol || ' '}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="flex shrink-0 gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleApply}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                应用润色结果
              </button>
              <button
                onClick={handlePolish}
                disabled={polishing}
                className="rounded-xl px-4 py-2 text-sm disabled:opacity-60"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                {polishing ? '润色中...' : '重新润色'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
