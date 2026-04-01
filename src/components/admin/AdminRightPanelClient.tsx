'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ADMIN_CARD_CLASS, ADMIN_SUBCARD_CLASS } from './adminUi'

type QuickLink = { href: string; label: string; icon: string; badge?: number }
type PendingComment = {
  id: string
  content: string
  guestName: string | null
  createdAt: Date
  post: { title: string; id: string }
}
type TopPost = { id: string; title: string; views: number }

type Module = 'quicklinks' | 'pending' | 'topposts'

const MODULE_LABELS: Record<Module, string> = {
  quicklinks: '快捷操作',
  pending: '待审评论',
  topposts: '热门文章',
}

const STORAGE_KEY = 'admin-right-panel'

type PanelState = {
  collapsed: boolean
  modules: Record<Module, boolean>
}

const DEFAULT_STATE: PanelState = {
  collapsed: false,
  modules: { quicklinks: true, pending: true, topposts: true },
}

export function AdminRightPanelClient({
  quickLinks,
  pendingComments,
  topPosts,
}: {
  quickLinks: QuickLink[]
  pendingComments: PendingComment[]
  topPosts: TopPost[]
}) {
  const [state, setState] = useState<PanelState>(DEFAULT_STATE)
  const [showSettings, setShowSettings] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setState({ ...DEFAULT_STATE, ...JSON.parse(saved) })
    } catch {}
    setMounted(true)
  }, [])

  const save = (next: PanelState) => {
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const toggleCollapse = () => save({ ...state, collapsed: !state.collapsed })
  const toggleModule = (m: Module) =>
    save({ ...state, modules: { ...state.modules, [m]: !state.modules[m] } })

  if (!mounted) return null

  return (
    <aside className="flex flex-col gap-3">
      {/* 顶栏：标题 + 设置 + 折叠 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>小组件</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(v => !v)}
            title="自定义模块"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: showSettings ? 'var(--accent)' : 'var(--text-secondary)', background: showSettings ? 'var(--bg-hover)' : 'transparent' }}
          >⚙</button>
          <button
            onClick={toggleCollapse}
            title={state.collapsed ? '展开' : '收起'}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >{state.collapsed ? '▶' : '◀'}</button>
        </div>
      </div>

      {/* 模块设置面板 */}
      {showSettings && !state.collapsed && (
        <div className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>显示模块</p>
          {(Object.keys(MODULE_LABELS) as Module[]).map(m => (
            <label key={m} className="flex items-center gap-2 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.modules[m]}
                onChange={() => toggleModule(m)}
                className="accent-[var(--accent)] w-3.5 h-3.5"
              />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{MODULE_LABELS[m]}</span>
            </label>
          ))}
        </div>
      )}

      {!state.collapsed && (
        <>
          {/* 快捷操作 */}
          {state.modules.quicklinks && (
            <div className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>快捷操作</h3>
              <div className="flex flex-col">
                {quickLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5 min-h-11"
                  >
                    <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </span>
                    {(link.badge ?? 0) > 0 ? (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--red)', color: '#fff' }}>
                        {link.badge}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>→</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 待审评论 */}
          {state.modules.pending && pendingComments.length > 0 && (
            <div className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>⏳ 待审评论</h3>
                <Link href="/admin/comments" className="text-xs" style={{ color: 'var(--accent)' }}>全部 →</Link>
              </div>
              <div className="flex flex-col gap-3">
                {pendingComments.map(c => (
                  <div key={c.id} className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {c.guestName || '匿名'}
                      </span>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(c.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs line-clamp-2 leading-5" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                    <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--accent)' }}>《{c.post.title}》</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 热门文章 */}
          {state.modules.topposts && topPosts.length > 0 && (
            <div className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>🔥 热门文章</h3>
              <div className="flex flex-col">
                {topPosts.map((post, i) => (
                  <Link
                    key={post.id}
                    href={`/admin/posts/${post.id}`}
                    className="flex items-center gap-2 py-2 hover:opacity-80 transition-opacity min-h-10"
                    style={{ borderBottom: i < topPosts.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: i < 3 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {i + 1}
                    </span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {post.title}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      {post.views} 阅
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}