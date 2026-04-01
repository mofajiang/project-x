'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type ThemeMode = 'dark' | 'light'
const THEME_CYCLE: ThemeMode[] = ['dark', 'light']
const THEME_LABELS: Record<ThemeMode, string> = { dark: '🌙 暗黑', light: '☀️ 浅色' }

function AdminThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('adminThemeMode') || localStorage.getItem('theme') || 'dark') as ThemeMode
    const valid = (THEME_CYCLE as string[]).includes(saved) ? saved as ThemeMode : 'dark'
    setTheme(valid)
    document.documentElement.classList.remove('dark', 'light', 'sepia')
    document.documentElement.classList.add(valid)
  }, [])

  const toggle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    localStorage.setItem('adminThemeMode', next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.remove('dark', 'light', 'sepia')
    document.documentElement.classList.add(next)
    // sepia 已移除，如已保存 sepia 则重置为 dark
  }

  return (
    <button
      onClick={toggle}
      title={`当前：${THEME_LABELS[theme]}，点击切换`}
      className={compact
        ? 'flex items-center gap-1 px-3 py-2 rounded-full text-xs transition-colors shrink-0'
        : 'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors'}
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{THEME_LABELS[theme].split(' ')[0]}</span>
      <span className={compact ? 'text-[11px]' : 'flex-1 text-left text-xs'}>{THEME_LABELS[theme].split(' ')[1]}</span>
      {!compact && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>切换</span>}
    </button>
  )
}

type UpdateInfo = {
  hasUpdate: boolean
  localCommit: string
  remoteCommit: string
  branch: string
  commits: { sha: string; message: string; date: string; author: string }[]
  checkedAt: string
  error?: string
}

function AdminUpdateChecker({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [confirmUpdate, setConfirmUpdate] = useState(false)
  const [updateLogs, setUpdateLogs] = useState<{ msg: string; error?: boolean }[]>([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const check = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/update', { cache: 'no-store' })
      const d = await r.json()
      setInfo(d)
    } catch {
      setInfo({ hasUpdate: false, localCommit: '', remoteCommit: '', branch: '', commits: [], checkedAt: '', error: '网络错误' })
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
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const doUpdate = async () => {
    if (!confirmUpdate) {
      setConfirmUpdate(true)
      // 3秒后自动取消确认状态
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
            if (obj.msg) setUpdateLogs(prev => [...prev, { msg: obj.msg, error: obj.error }])
            if (obj.done) {
              if (obj.success) {
                toast.success('✅ 更新完成，服务已重启')
                await check()
                setOpen(false)
              } else {
                toast.error('❌ 更新失败，请查看日志')
              }
            }
          } catch {}
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
        className={compact
          ? 'flex items-center justify-center gap-1 px-3 py-2 rounded-full text-xs transition-colors relative shrink-0 min-w-[68px]'
          : 'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors relative'}
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="relative inline-block leading-none">
          🔄
          {info?.hasUpdate && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#F4212E' }} />
          )}
        </span>
        <span className={compact ? 'text-[11px] leading-none' : 'flex-1 text-left text-xs'}>
          {loading ? '检查中' : info?.hasUpdate ? '更新' : '最新'}
        </span>
        {info?.hasUpdate && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(244,33,46,0.15)', color: '#F4212E' }}>NEW</span>
        )}
      </button>

      {open && (
        <div
          className={compact
            ? 'fixed z-50 rounded-2xl shadow-2xl overflow-hidden'
            : 'absolute left-0 bottom-full mb-2 z-50 w-[360px] max-w-[calc(100vw-16px)] rounded-2xl shadow-2xl overflow-hidden'}
          style={compact
            ? {
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                left: '50%',
                top: 'calc(3.5rem + env(safe-area-inset-top))',
                transform: 'translateX(-50%)',
                width: 'min(calc(100vw - 1rem), 360px)',
                maxHeight: 'calc(100vh - 5rem)',
              }
            : { background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className={compact ? 'p-3 flex flex-col gap-2 max-h-[70vh] overflow-y-auto' : 'p-4 flex flex-col gap-3 max-h-96 overflow-y-auto'}>
            <div className="flex items-center justify-between gap-2">
              <span className={compact ? 'font-bold text-xs' : 'font-bold text-sm'} style={{ color: 'var(--text-primary)' }}>🔄 版本更新</span>
              <button
                onClick={() => setOpen(false)}
                className={compact ? 'w-7 h-7 rounded-full flex items-center justify-center text-xs' : 'text-xs'}
                style={{ color: 'var(--text-secondary)', background: compact ? 'var(--bg-hover)' : 'transparent' }}
              >
                ✕
              </button>
            </div>

            <div className={compact ? 'grid grid-cols-1 gap-2 text-[11px]' : 'flex gap-2 text-xs'} style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: 'var(--bg-hover)' }}>
                <span className="shrink-0">本地</span>
                <code className="px-1 rounded bg-transparent">{info?.localCommit || '—'}</code>
              </span>
              <span className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: 'var(--bg-hover)' }}>
                <span className="shrink-0">远程</span>
                <code className="px-1 rounded bg-transparent">{info?.remoteCommit || '—'}</code>
              </span>
            </div>

            {info?.error && <p className={compact ? 'text-[11px]' : 'text-xs'} style={{ color: '#F4212E' }}>⚠️ {info.error}</p>}

            {info?.hasUpdate && info.commits.length > 0 && (
              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                <p className={compact ? 'text-[11px] font-medium' : 'text-xs font-medium'} style={{ color: 'var(--text-secondary)' }}>更新内容：</p>
                {info.commits.map(c => (
                  <div key={c.sha} className="flex flex-col gap-1 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                    <p className={compact ? 'text-[11px] leading-snug' : 'text-xs'} style={{ color: 'var(--text-primary)' }}>{c.message}</p>
                    <p className="text-[10px] leading-none" style={{ color: 'var(--text-secondary)' }}>{c.sha} · {c.author} · {c.date ? new Date(c.date).toLocaleDateString('zh-CN') : ''}</p>
                  </div>
                ))}
              </div>
            )}

            {!info?.hasUpdate && !info?.error && (
              <p className={compact ? 'text-[11px] text-center py-2' : 'text-xs text-center py-2'} style={{ color: 'var(--text-secondary)' }}>✅ 当前已是最新版本</p>
            )}

            {updateLogs.length > 0 && (
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto rounded-xl p-2" style={{ background: 'var(--bg)', fontFamily: 'monospace' }}>
                {updateLogs.map((log, i) => (
                  <p key={i} className={compact ? 'text-[10px] whitespace-pre-wrap' : 'text-[11px] whitespace-pre-wrap'} style={{ color: log.error ? '#F4212E' : 'var(--text-primary)' }}>{log.msg}</p>
                ))}
                {updating && <p className={compact ? 'text-[10px] animate-pulse' : 'text-[11px] animate-pulse'} style={{ color: 'var(--accent)' }}>▋</p>}
              </div>
            )}

            <div className={compact ? 'flex flex-col gap-2' : 'flex gap-2'}>
              <button onClick={check} disabled={loading || updating} className="flex-1 px-3 py-2 rounded-xl text-xs disabled:opacity-50" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                {loading ? '检查中...' : '重新检查'}
              </button>
              {info?.hasUpdate && (
                <button
                  onClick={doUpdate}
                  disabled={updating}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: confirmUpdate ? '#F4212E' : 'var(--accent)' }}
                >
                  {updating ? '更新中...' : confirmUpdate ? '⚠️ 再次点击确认' : '立即更新'}
                </button>
              )}
            </div>

            {info?.checkedAt && (
              <p className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>上次检查：{new Date(info.checkedAt).toLocaleTimeString('zh-CN')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const navItems = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '文章管理', href: '/admin/posts', icon: '📝' },
  { label: '评论管理', href: '/admin/comments', icon: '💬', badge: true },
  { label: '标签管理', href: '/admin/tags', icon: '🏷' },
  { label: '安全设置', href: '/admin/security', icon: '🔒' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️' },
  { label: '导航与组件', href: '/admin/navigation', icon: '🧭' },
]

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchPending = () => fetch('/api/admin/comments/pending')
      .then(r => r.json())
      .then(d => setPendingCount(d.count || 0))
      .catch(() => {})
    fetchPending()
    const timer = setInterval(fetchPending, 60_000)

    return () => clearInterval(timer)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    router.push('/admin/login')
  }

  return (
    <>
      {/* 桌面端左侧栏 */}
      <aside className="hidden md:flex w-56 min-h-screen flex-col py-6 px-3" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        <div className="px-3 mb-6">
          <p className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>⚙ 后台管理</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>@{username}</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors"
              style={{
                background: pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)) ? 'var(--bg-hover)' : 'transparent',
                color: pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)) ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname.startsWith(item.href) ? '600' : '400',
              }}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--red,#F4212E)', color: '#fff' }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>


        <div className="px-3 mt-4 flex flex-col gap-2">
          <AdminUpdateChecker />
          <AdminThemeToggle />
          <a href="/" target="_blank" className="text-sm py-2 px-3 rounded-xl text-center transition-colors hover:bg-x-bg-hover" style={{ color: 'var(--text-secondary)' }}>查看博客 ↗</a>
          <button onClick={logout} className="text-sm py-2 px-3 rounded-xl text-center transition-colors w-full" style={{ color: 'var(--red)' }}>退出登录</button>
        </div>
      </aside>

      {/* 移动端顶部 header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>⚙ 后台管理</p>
        <div className="flex items-center gap-2">
          <AdminUpdateChecker compact />
          <AdminThemeToggle compact />
          <a href="/" target="_blank" className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>前台 ↗</a>
          <button onClick={logout} className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--red)', border: '1px solid var(--border)' }}>退出</button>
        </div>
      </header>

      {/* 移动端底部 tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch overflow-x-auto overscroll-x-contain"
        style={{ background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[52px] py-2.5 px-1 text-[9px] relative transition-colors"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 400,
                background: active ? 'var(--bg-hover)' : 'transparent',
              }}>
              <span className="text-[17px] leading-none relative inline-block">
                {item.icon}
                {item.badge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 text-[8px] font-bold px-1 rounded-full leading-tight" style={{ background: 'var(--red,#F4212E)', color: '#fff', minWidth: '14px', textAlign: 'center' }}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </span>
              <span className="truncate w-full text-center px-0.5">{item.label.replace('管理','').replace('设置','').replace('通知','')}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}