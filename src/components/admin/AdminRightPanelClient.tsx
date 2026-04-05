'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
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
type RecentFailedTask = {
  id: string
  label: string
  summary: string
  riskLevel: 'medium' | 'high' | 'critical'
  status: 'success' | 'failed'
  actorUsername: string
  createdAt: string | Date
  detail: string
  href: string
  hrefLabel: string
}

type RecentHighRiskAction = {
  id: string
  label: string
  summary: string
  riskLevel: 'medium' | 'high' | 'critical'
  status: 'success' | 'failed'
  actorUsername: string
  createdAt: string | Date
}

type Module = 'quicklinks' | 'failedTasks' | 'recentActions' | 'pending' | 'topposts'

const MODULE_ORDER: Module[] = ['quicklinks', 'failedTasks', 'recentActions', 'pending', 'topposts']

const MODULE_LABELS: Record<Module, string> = {
  quicklinks: '快捷操作',
  failedTasks: '失败任务',
  recentActions: '高危操作',
  pending: '待审评论',
  topposts: '热门文章',
}



const STORAGE_KEY = 'admin-right-panel'
const COMMENTS_LINK_HREF = '/admin/comments'


type PanelState = {
  collapsed: boolean
  modules: Record<Module, boolean>
  pinned: Record<Module, boolean>
  order: Module[]
}

const DEFAULT_STATE: PanelState = {
  collapsed: false,
  modules: { quicklinks: true, failedTasks: true, recentActions: true, pending: true, topposts: true },
  pinned: { quicklinks: true, failedTasks: false, recentActions: false, pending: false, topposts: false },
  order: MODULE_ORDER,
}



export function AdminRightPanelClient({
  quickLinks,
  recentFailedTasks,
  recentHighRiskActions,
  pendingComments,
  topPosts,
}: {
  quickLinks: QuickLink[]
  recentFailedTasks: RecentFailedTask[]
  recentHighRiskActions: RecentHighRiskAction[]
  pendingComments: PendingComment[]
  topPosts: TopPost[]
}) {
  const router = useRouter()
  const [state, setState] = useState<PanelState>(DEFAULT_STATE)
  const [showSettings, setShowSettings] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dragging, setDragging] = useState<Module | null>(null)
  const [pendingItems, setPendingItems] = useState<PendingComment[]>(pendingComments)
  const [pendingCount, setPendingCount] = useState(() => quickLinks.find(link => link.href === COMMENTS_LINK_HREF)?.badge ?? pendingComments.length)
  const [actingCommentId, setActingCommentId] = useState<string | null>(null)


  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setState({
          ...DEFAULT_STATE,
          ...parsed,
          modules: { ...DEFAULT_STATE.modules, ...(parsed.modules || {}) },
          pinned: { ...DEFAULT_STATE.pinned, ...(parsed.pinned || {}) },
          order: Array.isArray(parsed.order) ? parsed.order : [...MODULE_ORDER],
        })
      }
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    setPendingItems(pendingComments)
    setPendingCount(quickLinks.find(link => link.href === COMMENTS_LINK_HREF)?.badge ?? pendingComments.length)
  }, [pendingComments, quickLinks])

  const save = (next: PanelState) => {
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }


  const toggleCollapse = () => save({ ...state, collapsed: !state.collapsed })
  const toggleModule = (m: Module) =>
    save({ ...state, modules: { ...state.modules, [m]: !state.modules[m] } })
  const togglePinned = (m: Module) =>
    save({ ...state, pinned: { ...state.pinned, [m]: !state.pinned[m] } })

  const moveModule = (from: Module, to: Module) => {
    if (from === to) return
    if (state.pinned[from] || state.pinned[to]) return
    const nextOrder = state.order.filter(m => m !== from)
    const insertAt = nextOrder.indexOf(to)
    nextOrder.splice(insertAt, 0, from)
    save({ ...state, order: nextOrder })
  }

  const orderedModules = state.order.filter(m => state.modules[m])
  const displayQuickLinks = quickLinks.map(link => link.href === COMMENTS_LINK_HREF ? { ...link, badge: pendingCount } : link)
  const formatDateTime = (value: string | Date) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const getRiskLabel = (riskLevel: RecentFailedTask['riskLevel']) => riskLevel === 'critical' ? '严重' : riskLevel === 'high' ? '高危' : '中风险'

  const handlePendingCommentAction = async (commentId: string, mode: 'approve' | 'delete') => {
    if (mode === 'delete' && !window.confirm('确认删除这条待审评论？')) return

    setActingCommentId(commentId)
    try {
      const res = await fetch(COMMENTS_LINK_HREF, {
        method: mode === 'approve' ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'approve' ? { id: commentId, approved: true } : { id: commentId }),
      })

      if (!res.ok) {
        let message = mode === 'approve' ? '评论通过失败' : '评论删除失败'
        try {
          const error = await res.json()
          if (error?.error) message = error.error
        } catch {}
        throw new Error(message)
      }

      setPendingItems(items => items.filter(item => item.id !== commentId))
      setPendingCount(count => Math.max(0, count - 1))
      toast.success(mode === 'approve' ? '评论已通过' : '评论已删除')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || '处理失败')
    } finally {
      setActingCommentId(null)
    }
  }

  const renderModule = (module: Module) => {


    if (module === 'quicklinks') {
      return (
        <div key={module} className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>快捷操作</h3>
          <div className="flex flex-col">
            {displayQuickLinks.map(link => (

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
      )
    }

    if (module === 'failedTasks') {
      return (
        <div key={module} className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🚨 最近失败任务</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>最近 5 条</span>
          </div>
          {recentFailedTasks.length ? (
            <div className="flex flex-col gap-3">
              {recentFailedTasks.map(task => (
                <div key={task.id} className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.label}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(249,24,128,0.14)', color: 'var(--red)' }}
                    >
                      {getRiskLabel(task.riskLevel)}
                    </span>
                  </div>
                  <p className="text-xs leading-5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.summary}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate">{task.actorUsername || '管理员'}</span>
                    <span className="shrink-0">{formatDateTime(task.createdAt)}</span>
                  </div>
                  {task.detail ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px]" style={{ color: 'var(--accent)' }}>查看错误详情</summary>
                      <p className="mt-2 text-[10px] leading-5 whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)' }}>{task.detail}</p>
                    </details>
                  ) : null}
                  <div className="mt-2 flex justify-end">
                    <Link href={task.href} className="text-[10px] font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                      {task.hrefLabel} →
                    </Link>
                  </div>
                </div>
              ))}

            </div>
          ) : (
            <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
              <p className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>最近没有失败任务，配置保存、系统更新、日志清理等后台动作一旦失败，会优先出现在这里。</p>
            </div>
          )}
        </div>
      )
    }

    if (module === 'recentActions') {
      return (
        <div key={module} className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>⚠️ 最近高危操作</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>实时追踪</span>
          </div>
          {recentHighRiskActions.length ? (
            <div className="flex flex-col gap-3">
              {recentHighRiskActions.map(action => (
                <div key={action.id} className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: action.status === 'failed' ? 'rgba(249,24,128,0.14)' : 'rgba(0,186,124,0.14)',
                        color: action.status === 'failed' ? 'var(--red)' : 'var(--green)',
                      }}
                    >
                      {action.status === 'failed' ? '失败' : '成功'}
                    </span>
                  </div>
                  <p className="text-xs leading-5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{action.summary}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate">{action.actorUsername || '管理员'}</span>
                    <span className="shrink-0">{formatDateTime(action.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
              <p className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>还没有高危操作记录，新的系统更新、密码修改、清空日志等动作会从现在开始出现在这里。</p>
            </div>
          )}
        </div>
      )
    }


    if (module === 'pending') {
      return (
        <div key={module} className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>⏳ 待审评论</h3>
            <Link href={COMMENTS_LINK_HREF} className="text-xs" style={{ color: 'var(--accent)' }}>全部 →</Link>
          </div>
          {pendingItems.length ? (
            <div className="flex flex-col gap-3">
              {pendingItems.map(c => {
                const isActing = actingCommentId === c.id

                return (
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
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handlePendingCommentAction(c.id, 'approve')}
                        className="px-3 py-1.5 rounded-full text-[10px] font-medium disabled:opacity-50"
                        style={{ background: 'rgba(0,186,124,0.15)', color: 'var(--green)' }}
                      >
                        {isActing ? '处理中...' : '通过'}
                      </button>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handlePendingCommentAction(c.id, 'delete')}
                        className="px-3 py-1.5 rounded-full text-[10px] font-medium disabled:opacity-50"
                        style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={ADMIN_SUBCARD_CLASS} style={{ background: 'var(--bg-hover)' }}>
              <p className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>当前没有待审评论，新的访客评论会在这里出现并支持直接处理。</p>
            </div>
          )}
        </div>
      )
    }


    if (module === 'topposts') {
      if (!topPosts.length) return null
      return (
        <div key={module} className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
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
      )
    }

    return null
  }

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
            <div
              key={m}
              draggable={!state.pinned[m] && state.modules[m]}
              onDragStart={() => setDragging(m)}
              onDragEnd={() => setDragging(null)}
              onDragOver={e => {
                if (!dragging || dragging === m) return
                if (state.pinned[dragging] || state.pinned[m]) return
                e.preventDefault()
              }}
              onDrop={e => {
                e.preventDefault()
                if (dragging) moveModule(dragging, m)
                setDragging(null)
              }}
              className="flex items-center gap-2 py-1 select-none"
            >
              <button
                type="button"
                onClick={() => toggleModule(m)}
                className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center"
                style={{ background: state.modules[m] ? 'var(--accent)' : 'transparent', borderColor: 'var(--accent)' }}
                aria-label={state.modules[m] ? '隐藏模块' : '显示模块'}
              >
                {state.modules[m] && <span className="text-[10px] text-white leading-none">✓</span>}
              </button>
              <span className="text-xs flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>{MODULE_LABELS[m]}</span>
              <button
                type="button"
                onClick={() => togglePinned(m)}
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: state.pinned[m] ? 'rgba(29,155,240,0.14)' : 'var(--bg-hover)',
                  color: state.pinned[m] ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                title={state.pinned[m] ? '取消固定' : '固定到当前位置'}
              >
                {state.pinned[m] ? '已固定' : '固定'}
              </button>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: dragging === m ? 'rgba(29,155,240,0.14)' : 'transparent', color: 'var(--text-secondary)' }}>
                {state.pinned[m] ? '锁定' : '拖动'}
              </span>
            </div>
          ))}
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>拖动可调整模块顺序，固定后该模块不会被拖拽改变位置。</p>
        </div>
      )}

      {!state.collapsed && (
        <>
          {orderedModules.map(module => renderModule(module))}
        </>
      )}
    </aside>
  )
}