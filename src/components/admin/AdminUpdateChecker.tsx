'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'

type UpdateInfo = {
  hasUpdate: boolean
  localCommit: string
  remoteCommit: string
  branch: string
  commits: { sha: string; message: string; date: string; author: string }[]
  checkedAt: string
  error?: string
}

export function AdminUpdateChecker({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [confirmUpdate, setConfirmUpdate] = useState(false)
  const [updateLogs, setUpdateLogs] = useState<{ msg: string; error?: boolean }[]>([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const check = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/update', { cache: 'no-store' })
      const d = await r.json()
      setInfo(d)
    } catch {
      setInfo({
        hasUpdate: false,
        localCommit: '',
        remoteCommit: '',
        branch: '',
        commits: [],
        checkedAt: '',
        error: '网络错误',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    check()
    const t = setInterval(check, 10 * 60 * 1000) // 每10分钟自动检查
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !portalRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const doUpdate = async () => {
    if (!confirmUpdate) {
      setConfirmUpdate(true)
      setTimeout(() => setConfirmUpdate(false), 3000)
      return
    }
    setConfirmUpdate(false)
    setUpdating(true)
    setUpdateLogs([])
    try {
      const res = await fetch('/api/admin/update', { method: 'POST' })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const obj = JSON.parse(line.slice(6))
            if (obj.msg) setUpdateLogs((prev) => [...prev, { msg: obj.msg, error: obj.error }])
            if (obj.done) {
              if (obj.success) {
                toast.success('✅ 更新完成，服务已重启')
                await check()
                setOpen(false)
              } else {
                toast.error('❌ 更新失败，请查看日志')
              }
            }
          } catch (e) {
            const rawContent = line.slice(6)
            console.error('[SSE parse error]', e, 'raw:', rawContent)
            setUpdateLogs((prev) => [
              ...prev,
              {
                msg: `⚠️ 解析响应异常: ${rawContent.slice(0, 100)}`,
                error: true,
              },
            ])
          }
        }
      }
    } catch {
      toast.error('更新请求失败')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen && !info) check()
        }}
        title={info?.hasUpdate ? `有新版本可用（${info.commits.length} 个更新）` : '检查更新'}
        className={
          compact
            ? 'relative flex min-w-[68px] shrink-0 items-center justify-center gap-1 rounded-full px-3 py-2 text-xs transition-colors'
            : 'relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors'
        }
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="relative inline-block leading-none">
          🔄
          {info?.hasUpdate && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full" style={{ background: '#F4212E' }} />
          )}
        </span>
        <span className={compact ? 'text-[11px] leading-none' : 'flex-1 text-left text-xs'}>
          {loading ? '检查中' : info?.hasUpdate ? '更新' : '最新'}
        </span>
        {info?.hasUpdate && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(244,33,46,0.15)', color: '#F4212E' }}
          >
            NEW
          </span>
        )}
      </button>

      {open &&
        (compact && mounted ? (
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setOpen(false)}
            >
              <div
                ref={portalRef}
                className="overflow-hidden rounded-2xl shadow-2xl"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  width: 'min(calc(100vw - 2rem), 360px)',
                  maxHeight: 'min(70vh, 600px)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={
                    compact
                      ? 'flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-3'
                      : 'flex max-h-96 flex-col gap-3 overflow-y-auto p-4'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={compact ? 'text-xs font-bold' : 'text-sm font-bold'}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      🔄 版本更新
                    </span>
                    <button
                      onClick={() => setOpen(false)}
                      className={compact ? 'flex h-7 w-7 items-center justify-center rounded-full text-xs' : 'text-xs'}
                      style={{
                        color: 'var(--text-secondary)',
                        background: compact ? 'var(--bg-hover)' : 'transparent',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    className={compact ? 'grid grid-cols-1 gap-2 text-[11px]' : 'flex gap-2 text-xs'}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                      style={{ background: 'var(--bg-hover)' }}
                    >
                      <span className="shrink-0">本地</span>
                      <code className="rounded bg-transparent px-1">{info?.localCommit || '—'}</code>
                    </span>
                    <span
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                      style={{ background: 'var(--bg-hover)' }}
                    >
                      <span className="shrink-0">远程</span>
                      <code className="rounded bg-transparent px-1">{info?.remoteCommit || '—'}</code>
                    </span>
                  </div>

                  {info?.error && (
                    <p className={compact ? 'text-[11px]' : 'text-xs'} style={{ color: '#F4212E' }}>
                      ⚠️ {info.error}
                    </p>
                  )}

                  {info?.hasUpdate && info.commits.length > 0 && (
                    <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                      <p
                        className={compact ? 'text-[11px] font-medium' : 'text-xs font-medium'}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        更新内容：
                      </p>
                      {info.commits.map((c) => (
                        <div
                          key={c.sha}
                          className="flex flex-col gap-1 rounded-xl px-3 py-2"
                          style={{ background: 'var(--bg-hover)' }}
                        >
                          <p
                            className={compact ? 'text-[11px] leading-snug' : 'text-xs'}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {c.message}
                          </p>
                          <p className="text-[10px] leading-none" style={{ color: 'var(--text-secondary)' }}>
                            {c.sha} · {c.author} · {c.date ? new Date(c.date).toLocaleDateString('zh-CN') : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!info?.hasUpdate && !info?.error && (
                    <p
                      className={compact ? 'py-2 text-center text-[11px]' : 'py-2 text-center text-xs'}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ✅ 当前已是最新版本
                    </p>
                  )}

                  {updateLogs.length > 0 && (
                    <div
                      className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-xl p-2"
                      style={{ background: 'var(--bg)', fontFamily: 'monospace' }}
                    >
                      {updateLogs.map((log, i) => (
                        <p
                          key={i}
                          className={compact ? 'whitespace-pre-wrap text-[10px]' : 'whitespace-pre-wrap text-[11px]'}
                          style={{ color: log.error ? '#F4212E' : 'var(--text-primary)' }}
                        >
                          {log.msg}
                        </p>
                      ))}
                      {updating && (
                        <p
                          className={compact ? 'animate-pulse text-[10px]' : 'animate-pulse text-[11px]'}
                          style={{ color: 'var(--accent)' }}
                        >
                          ▋
                        </p>
                      )}
                    </div>
                  )}

                  <div className={compact ? 'flex flex-col gap-2' : 'flex gap-2'}>
                    <button
                      onClick={check}
                      disabled={loading || updating}
                      className="flex-1 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      {loading ? '检查中...' : '重新检查'}
                    </button>
                    {info?.hasUpdate && (
                      <button
                        onClick={doUpdate}
                        disabled={updating}
                        className="flex-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
                        style={{ background: confirmUpdate ? '#F4212E' : 'var(--accent)' }}
                      >
                        {updating ? '更新中...' : confirmUpdate ? '⚠️ 再次点击确认' : '立即更新'}
                      </button>
                    )}
                  </div>

                  {info?.checkedAt && (
                    <p className="text-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      上次检查：{new Date(info.checkedAt).toLocaleTimeString('zh-CN')}
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        ) : (
          <div
            className="absolute bottom-full left-0 z-[9999] mb-2 w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl shadow-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  🔄 版本更新
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                  style={{ background: 'var(--bg-hover)' }}
                >
                  <span className="shrink-0">本地</span>
                  <code className="rounded bg-transparent px-1">{info?.localCommit || '—'}</code>
                </span>
                <span
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                  style={{ background: 'var(--bg-hover)' }}
                >
                  <span className="shrink-0">远程</span>
                  <code className="rounded bg-transparent px-1">{info?.remoteCommit || '—'}</code>
                </span>
              </div>

              {info?.error && (
                <p className="text-xs" style={{ color: '#F4212E' }}>
                  ⚠️ {info.error}
                </p>
              )}

              {info?.hasUpdate && info.commits.length > 0 && (
                <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    更新内容：
                  </p>
                  {info.commits.map((c) => (
                    <div
                      key={c.sha}
                      className="flex flex-col gap-1 rounded-xl px-3 py-2"
                      style={{ background: 'var(--bg-hover)' }}
                    >
                      <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                        {c.message}
                      </p>
                      <p className="text-[10px] leading-none" style={{ color: 'var(--text-secondary)' }}>
                        {c.sha} · {c.author} · {c.date ? new Date(c.date).toLocaleDateString('zh-CN') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!info?.hasUpdate && !info?.error && (
                <p className="py-2 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                  ✅ 当前已是最新版本
                </p>
              )}

              {updateLogs.length > 0 && (
                <div
                  className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-xl p-2"
                  style={{ background: 'var(--bg)', fontFamily: 'monospace' }}
                >
                  {updateLogs.map((log, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-wrap text-[11px]"
                      style={{ color: log.error ? '#F4212E' : 'var(--text-primary)' }}
                    >
                      {log.msg}
                    </p>
                  ))}
                  {updating && (
                    <p className="animate-pulse text-[11px]" style={{ color: 'var(--accent)' }}>
                      ▋
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={check}
                  disabled={loading || updating}
                  className="flex-1 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  {loading ? '检查中...' : '重新检查'}
                </button>
                {info?.hasUpdate && (
                  <button
                    onClick={doUpdate}
                    disabled={updating}
                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: confirmUpdate ? '#F4212E' : 'var(--accent)' }}
                  >
                    {updating ? '更新中...' : confirmUpdate ? '⚠️ 再次点击确认' : '立即更新'}
                  </button>
                )}
              </div>

              {info?.checkedAt && (
                <p className="text-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  上次检查：{new Date(info.checkedAt).toLocaleTimeString('zh-CN')}
                </p>
              )}
            </div>
          </div>
        ))}
    </div>
  )
}
