'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { JWTPayload } from '@/lib/auth'
import type { RightPanelWidget, FriendLink } from '@/lib/config'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { NavItemDef } from './Sidebar'

const IconHome = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.75}>
    {filled ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /> : <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
  </svg>
)
const IconArchive = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const IconTag = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M7 7h.01M3 3h8l9 9a2 2 0 010 2.828l-5.172 5.172a2 2 0 01-2.828 0L3 11V3z" />
  </svg>
)
const IconUser = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

const ICON_MAP: Record<string, React.ComponentType<{ filled?: boolean }>> = {
  home: IconHome,
  archive: IconArchive,
  tag: IconTag,
  user: IconUser,
}

const DEFAULT_NAV: NavItemDef[] = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '归档', href: '/archive', icon: 'archive' },
  { label: '标签', href: '/tags', icon: 'tag' },
  { label: '关于', href: '/about', icon: 'user' },
]

interface Props {
  open: boolean
  onClose: () => void
  navItems?: NavItemDef[]
  session?: JWTPayload | null
  avatar?: string | null
  displayName?: string
  handle?: string
  siteDesc?: string
  social?: { x: string; github: string; email: string }
  widgets?: RightPanelWidget[]
  copyright?: string
  topTags?: { id: string; name: string; slug: string; posts: number }[]
  hotPosts?: { id: string; title: string; slug: string; views: number }[]
}

export function MobileDrawer({ open, onClose, navItems, session, avatar, displayName = '', handle = '', siteDesc = '', social = { x: '', github: '', email: '' }, widgets = [], copyright = '', topTags = [], hotPosts = [] }: Props) {
  const items = (navItems && navItems.length > 0) ? navItems : DEFAULT_NAV
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const enabledWidgets = widgets.filter(w => w.enabled)

  // 路由变化时关闭抽屉
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // 锁定 body 滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setMenuOpen(false)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const logout = async () => {
    setMenuOpen(false)
    onClose()
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    router.refresh()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose()
      }}
    >
      {/* 抽屉主体 — 从左侧滑入 */}
      <div
        ref={drawerRef}
        className="absolute left-0 top-0 h-full w-72 flex flex-col py-4 px-3"
        style={{
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          animation: 'drawerSlideIn 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部：logo + 关闭 */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xl font-black select-none" style={{ color: 'var(--text-primary)' }}>✕</span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 导航项 */}
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const Icon = ICON_MAP[item.icon] || IconHome
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 rounded-full transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="flex-shrink-0"><Icon filled={active} /></span>
                <span className="text-[17px]" style={{ fontWeight: active ? 700 : 400 }}>{item.label}</span>
              </Link>
            )
          })}

          {/* 写文章按钮（登录后显示） */}
          {session && (
            <button
              onClick={() => { onClose(); window.dispatchEvent(new Event('open-compose')) }}
              className="mt-3 mx-2 py-3 rounded-full font-bold text-white text-[15px] transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'var(--accent)' }}
            >
              写文章
            </button>
          )}

          {/* 右侧栏（移动端） */}
          {enabledWidgets.length > 0 && (
            <div className="mt-4 px-1 pb-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>右侧栏</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>与桌面同源</span>
              </div>

              {enabledWidgets.map((widget, index) => {
                const title = widget.title?.trim() || ({ search: '搜索', about: '关于我', tags: '热门标签', hotPosts: '热门文章', custom: '自定义文本', links: '友情链接', carousel: '轮播图' } as Record<string, string>)[widget.type]

                if (widget.type === 'search') {
                  return (
                    <Link key={`search-${index}`} href="/search" className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-colors" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span>🔎</span>
                        <span className="text-sm font-medium truncate">站内搜索</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}>打开</span>
                    </Link>
                  )
                }

                if (widget.type === 'about') {
                  if (!siteDesc && !social.x && !social.github && !social.email) return null
                  return (
                    <div key={`about-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="px-4 pt-3 pb-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      </div>
                      {siteDesc && <p className="px-4 pb-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{siteDesc}</p>}
                      {(social.x || social.github || social.email) && (
                        <div className="flex flex-wrap gap-2 px-4 pb-4">
                          {social.x && <a href={`https://x.com/${social.x}`} target="_blank" className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>𝕏 @{social.x}</a>}
                          {social.github && <a href={`https://github.com/${social.github}`} target="_blank" className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>GitHub</a>}
                          {social.email && <a href={`mailto:${social.email}`} className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>邮件</a>}
                        </div>
                      )}
                    </div>
                  )
                }

                if (widget.type === 'tags') {
                  if (!topTags.length) return null
                  return (
                    <div key={`tags-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="px-4 pt-3 pb-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 px-4 pb-4">
                        {topTags.slice(0, 8).map(tag => (
                          <Link key={tag.id} href={`/tag/${tag.slug}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                            <span>#{tag.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{tag.posts}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                }

                if (widget.type === 'hotPosts') {
                  if (!hotPosts.length) return null
                  return (
                    <div key={`hot-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="px-4 pt-3 pb-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      </div>
                      <div className="flex flex-col">
                        {hotPosts.slice(0, 5).map((post, idx) => (
                          <Link key={post.id} href={`/post/${post.slug}`} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                            <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{post.title}</span>
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>{post.views} 阅</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                }

                if (widget.type === 'custom') {
                  if (!widget.content) return null
                  return (
                    <div key={`custom-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      {title && <div className="px-4 pt-3 pb-2"><h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3></div>}
                      <div className="px-4 pb-4 text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{widget.content}</div>
                    </div>
                  )
                }

                if (widget.type === 'links') {
                  const links: FriendLink[] = widget.links || []
                  if (!links.length) return null
                  return (
                    <div key={`links-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="px-4 pt-3 pb-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      </div>
                      <div className="flex flex-col pb-2">
                        {links.slice(0, 6).map((link, idx) => (
                          <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                              {link.avatar ? <img src={link.avatar} alt={link.label} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{link.label[0]?.toUpperCase()}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{link.label}</p>
                              {link.desc && <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{link.desc}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                }

                if (widget.type === 'carousel') {
                  const slides = widget.slides || []
                  if (!slides.length) return null
                  const first = slides[0]
                  return (
                    <div key={`carousel-${index}`} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <div className="px-4 pt-3 pb-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      </div>
                      <div className="px-4 pb-4">
                        {first.image && <img src={first.image} alt={first.title || title} className="w-full h-24 object-cover rounded-xl mb-2" />}
                        {first.title && <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{first.title}</p>}
                        {(first.desc || first.markdown) && <p className="text-[10px] leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{first.desc || first.markdown}</p>}
                      </div>
                    </div>
                  )
                }

                return null
              })}

              {copyright && (
                <div className="rounded-2xl px-4 py-3 text-[11px] leading-relaxed" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: copyright }} />
              )}
            </div>
          )}
        </nav>

        {/* 底部用户卡片 */}
        {session && (
          <div className="mt-auto relative">
            {/* 弹出菜单 */}
            {menuOpen && (
              <div
                className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-2xl overflow-hidden shadow-xl"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <Link
                  href="/admin"
                  onClick={() => { setMenuOpen(false); onClose() }}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                  后台控制台
                </Link>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>切换主题</span>
                  <ThemeToggle className="w-9 h-9" />
                </div>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-bold w-full text-left transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  退出登录 @{session.username}
                </button>
              </div>
            )}

            {/* 用户卡片触发按钮 */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-3 w-full px-2 py-2.5 rounded-full transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-base"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {avatar
                  ? <img src={avatar} alt={session.username} className="w-full h-full object-cover" />
                  : session.username[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm font-bold truncate w-full" style={{ color: 'var(--text-primary)' }}>
                  {displayName || handle || session.username}
                </span>
                <span className="text-xs truncate w-full" style={{ color: 'var(--text-secondary)' }}>
                  @{handle || session.username}
                </span>
              </div>
              <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
