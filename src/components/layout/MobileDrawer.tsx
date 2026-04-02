'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { JWTPayload } from '@/lib/auth'
import type { RightPanelWidget, FriendLink, SiteLogo } from '@/lib/config'
import { isImageSource } from '@/lib/config'
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
  onLogoClick?: () => void
  siteLogo?: SiteLogo | null
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

export function MobileDrawer({ open, onClose, onLogoClick, siteLogo, navItems, session, avatar, displayName = '', handle = '', siteDesc = '', social = { x: '', github: '', email: '' }, widgets = [], copyright = '', topTags = [], hotPosts = [] }: Props) {
  const items = (navItems && navItems.length > 0) ? navItems : DEFAULT_NAV
  const primaryItems = items.slice(0, 4)
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const enabledWidgets = widgets.filter(w => w.enabled && w.mobileVisible !== false)
  const logoValue = (siteLogo?.value || '✕').trim() || '✕'
  const isLogoImage = siteLogo?.type === 'image' && isImageSource(logoValue)

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
        className="absolute left-0 top-0 h-full w-[min(84vw,20rem)] flex flex-col py-2.5 px-3"
        style={{
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          animation: 'drawerSlideIn 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center pb-3 px-1">
          <button
            type="button"
            onClick={onLogoClick || onClose}
            className={isLogoImage
              ? "w-9 h-9 px-1.5 rounded-full flex items-center justify-center text-[22px] font-black transition-colors select-none overflow-hidden"
              : "min-w-[2.5rem] h-10 px-3 rounded-full flex items-center justify-center text-[22px] font-black transition-colors select-none overflow-hidden"}
            style={{ color: 'var(--text-primary)' }}
            title="首页"
            aria-label="返回首页"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,155,240,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isLogoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoValue} alt="首页" className="w-[18px] h-[18px] flex-none object-contain" />
            ) : (
              <span className={siteLogo?.type === 'text' ? 'text-[18px] font-black leading-none' : 'text-[22px] leading-none'}>
                {logoValue}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* 主入口 */}
          <section className="px-1 space-y-1.5">
            <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {primaryItems.map((item, index) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const Icon = ICON_MAP[item.icon] || IconHome
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors"
                    style={{
                      color: 'var(--text-primary)',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="flex-shrink-0 text-[var(--text-secondary)]"><Icon filled={active} /></span>
                    <span className="flex-1 text-[15px]" style={{ fontWeight: active ? 700 : 500 }}>{item.label}</span>
                    {active && <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                  </Link>
                )
              })}

              {session && (
                <button
                  onClick={() => { onClose(); window.dispatchEvent(new Event('open-compose')) }}
                  className="flex items-center justify-between gap-3 w-full px-4 py-3.5 text-left transition-colors"
                  style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-[15px] font-medium">写文章</span>
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* 右侧栏轻信息流 */}
          {enabledWidgets.length > 0 && (
            <section className="px-1 pb-1 space-y-3">
              <div className="space-y-3">
                {enabledWidgets.map((widget, index) => {
                  const title = widget.title?.trim() || ({ search: '搜索', about: '关于我', tags: '热门标签', hotPosts: '热门文章', custom: '自定义文本', links: '友情链接', carousel: '轮播图' } as Record<string, string>)[widget.type]

                  if (widget.type === 'search') {
                    return (
                      <Link key={`search-${index}`} href="/search" className="flex items-center justify-between gap-3 px-1 py-2.5 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                        <span className="flex items-center gap-2 min-w-0">
                          <span>🔎</span>
                          <span className="text-sm font-medium truncate">站内搜索</span>
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--accent)' }}>打开</span>
                      </Link>
                    )
                  }

                  if (widget.type === 'about') {
                    if (!siteDesc && !social.x && !social.github && !social.email) return null
                    return (
                      <div key={`about-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                        {siteDesc && <p className="px-1 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-primary)' }}>{siteDesc}</p>}
                        {(social.x || social.github || social.email) && (
                          <div className="flex flex-wrap gap-2 px-1 pt-2">
                            {social.x && <a href={`https://x.com/${social.x}`} target="_blank" className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>𝕏 @{social.x}</a>}
                            {social.github && <a href={`https://github.com/${social.github}`} target="_blank" className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>GitHub</a>}
                            {social.email && <a href={`mailto:${social.email}`} className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>邮件</a>}
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (widget.type === 'tags') {
                    if (!topTags.length) return null
                    return (
                      <div key={`tags-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {topTags.slice(0, 8).map(tag => (
                            <Link key={tag.id} href={`/tag/${tag.slug}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                              <span className="truncate max-w-[8.5rem]">#{tag.name}</span>
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
                      <div key={`hot-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                        <div className="flex flex-col">
                          {hotPosts.slice(0, 5).map((post, idx) => (
                            <Link key={post.id} href={`/post/${post.slug}`} className="flex items-center justify-between gap-3 px-1 py-1.5" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                              <span className="text-xs font-medium truncate leading-5" style={{ color: 'var(--text-primary)' }}>{post.title}</span>
                              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>{post.views}阅</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (widget.type === 'custom') {
                    if (!widget.content) return null
                    return (
                      <div key={`custom-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        {title && <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</h3>}
                        <div className="px-1 text-xs leading-relaxed whitespace-pre-wrap line-clamp-4" style={{ color: 'var(--text-primary)' }}>{widget.content}</div>
                      </div>
                    )
                  }

                  if (widget.type === 'links') {
                    const links: FriendLink[] = widget.links || []
                    if (!links.length) return null
                    return (
                      <div key={`links-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                        <div className="flex flex-col">
                          {links.slice(0, 6).map((link, idx) => (
                            <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-1 py-1.5" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                              <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                                {link.avatar ? <img src={link.avatar} alt={link.label} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{link.label[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{link.label}</p>
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
                      <div key={`carousel-${index}`} className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="px-1 text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                        <div className="px-1 flex items-start gap-3">
                          {first.image && <img src={first.image} alt={first.title || title} className="w-14 h-14 object-cover rounded-xl shrink-0" />}
                          <div className="min-w-0 flex-1">
                            {first.title && <p className="text-xs font-medium leading-5 truncate" style={{ color: 'var(--text-primary)' }}>{first.title}</p>}
                            {(first.desc || first.markdown) && <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{first.desc || first.markdown}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return null
                })}

                {copyright && (
                  <div className="pt-2 border-t px-1 text-[10px] leading-relaxed opacity-90" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: copyright }} />
                )}
              </div>
            </section>
          )}
        </div>

        {session && (
          <div className="mt-2 pt-1.5 border-t relative" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="打开账号菜单"
              className="flex items-center gap-2 w-full px-1.5 py-1.25 rounded-full transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,155,240,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-[12px]"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {avatar
                  ? <img src={avatar} alt={session.username} className="w-full h-full object-cover" />
                  : session.username[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1 pr-1">
                <span className="text-[12.5px] font-semibold truncate w-full leading-4" style={{ color: 'var(--text-primary)' }}>
                  {displayName || handle || session.username}
                </span>
                <span className="text-[9px] truncate w-full leading-4" style={{ color: 'var(--text-secondary)' }}>
                  @{handle || session.username}
                </span>
              </div>
              <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-secondary)' }}>
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {/* 弹出菜单 */}
            {menuOpen && (
              <div className="mt-1.5 overflow-hidden" style={{ borderTop: '1px solid var(--border)' }}>
                <Link
                  href="/admin"
                  onClick={() => { setMenuOpen(false); onClose() }}
                  className="flex items-center gap-3 px-0.5 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,155,240,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                  后台控制台
                </Link>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div className="flex items-center justify-between px-0.5 py-2.5" onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,155,240,0.05)')}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>切换主题</span>
                  <ThemeToggle className="w-8 h-8" />
                </div>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-0.5 py-2.5 text-sm font-medium w-full text-left transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,155,240,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  退出登录 @{session.username}
                </button>
              </div>
            )}
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
