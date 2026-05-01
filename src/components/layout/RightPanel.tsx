import DOMPurify from 'isomorphic-dompurify'
import Image from 'next/image'
import { SearchBox } from './SearchBox'
import { CarouselWidget } from './CarouselWidget'
import type { RightPanelWidget, FriendLink } from '@/lib/config'
import { getPostPath } from '@/lib/post-link'

interface TagItem {
  id: string
  name: string
  slug: string
  _count: { posts: number }
}

interface PostItem {
  id: string
  publicId: number | null
  title: string
  slug: string
  views: number
  author: { username: string }
}

interface FriendLinkItem {
  id: string
  name: string
  url: string
  description: string | null
  favicon: string | null
}

interface Props {
  siteDesc: string
  social: { x: string; github: string; email: string }
  widgets?: RightPanelWidget[]
  copyright?: string
  topTags: TagItem[]
  hotPosts: PostItem[]
  sidebarFriendLinks: FriendLinkItem[]
  friendLinksDefaultOpen: boolean
}

const DEFAULT_TITLES: Record<string, string> = {
  about: '关于我',
  tags: '热门标签',
  hotPosts: '热门文章',
  links: '自定义链接',
}

export function RightPanel({
  siteDesc,
  social,
  widgets = [],
  copyright = '',
  topTags,
  hotPosts,
  sidebarFriendLinks,
  friendLinksDefaultOpen,
}: Props) {
  const enabledWidgets = widgets.filter((w) => w.enabled)

  return (
    <aside
      aria-label="侧边栏"
      className="no-scrollbar sticky top-0 hidden h-screen w-[350px] overflow-y-auto px-4 py-4 lg:block"
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      {enabledWidgets.map((widget, i) => {
        const title = widget.title || DEFAULT_TITLES[widget.type] || ''

        if (widget.type === 'search') {
          return <SearchBox key={i} />
        }

        if (widget.type === 'about') {
          if (!siteDesc && !social.x && !social.github && !social.email) return null
          return (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="mb-2 px-4 pt-3 text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h2>
              {siteDesc && (
                <p className="px-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {siteDesc}
                </p>
              )}
              {(social.x || social.github || social.email) && (
                <div className="mb-3 mt-3 flex flex-wrap gap-2 px-4 pb-1">
                  {social.x && (
                    <a
                      href={`https://x.com/${social.x}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      𝕏 @{social.x}
                    </a>
                  )}
                  {social.github && (
                    <a
                      href={`https://github.com/${social.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      GitHub
                    </a>
                  )}
                  {social.email && (
                    <a
                      href={`mailto:${social.email}`}
                      className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      邮件
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        }

        if (widget.type === 'tags') {
          if (!topTags.length) return null
          return (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="px-4 pb-1 pt-3 text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h2>
              <div className="flex flex-col">
                {topTags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-normal" style={{ color: 'var(--text-secondary)' }}>
                        标签
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        #{tag.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {tag._count.posts} 篇
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        }

        if (widget.type === 'hotPosts') {
          if (!hotPosts.length) return null
          return (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="px-4 pb-1 pt-3 text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h2>
              <div className="flex flex-col">
                {hotPosts.map((post, idx) => (
                  <a
                    key={post.id}
                    href={getPostPath(post)}
                    className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        热门 · 第 {idx + 1}
                      </span>
                      <span
                        className="truncate text-sm font-bold group-hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {post.title}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {post.views} 次浏览
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        }

        if (widget.type === 'custom') {
          if (!widget.content) return null
          return (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              {title && (
                <h2 className="px-4 pb-1 pt-3 text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h2>
              )}
              <div
                className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {widget.content}
              </div>
            </div>
          )
        }

        if (widget.type === 'links') {
          const links = (widget.links || []) as FriendLink[]
          if (!links.length) return null
          return (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors hover:bg-white/5">
                  <span className="text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </span>
                  <span
                    className="text-sm transition-transform duration-150 group-open:rotate-180"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    ⌄
                  </span>
                </summary>
                <div className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
                  {links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                    >
                      {/* 头像/首字母 */}
                      <div
                        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      >
                        {link.avatar ? (
                          <Image src={link.avatar} alt={link.label} fill className="object-cover" unoptimized />
                        ) : (
                          <span>{link.label[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      {/* 名称 + 简介 */}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {link.label}
                        </span>
                        {link.desc && (
                          <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {link.desc}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </details>
            </div>
          )
        }

        if (widget.type === 'carousel') {
          const slides = widget.slides || []
          if (!slides.length) return null
          return <CarouselWidget key={i} slides={slides} interval={widget.interval || 3000} title={title} />
        }

        return null
      })}

      {sidebarFriendLinks.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
          <details className="group" open={friendLinksDefaultOpen || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors hover:bg-white/5">
              <span className="text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                友情链接
              </span>
              <span
                className="text-sm transition-transform duration-150 group-open:rotate-180"
                style={{ color: 'var(--text-secondary)' }}
              >
                ⌄
              </span>
            </summary>
            <div className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
              {sidebarFriendLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <div
                    className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {link.favicon ? (
                      <Image src={link.favicon} alt={link.name} fill className="object-cover" unoptimized />
                    ) : (
                      <span>{link.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {link.name}
                    </span>
                    {link.description && (
                      <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {link.description}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* 版权信息 */}
      {copyright && (
        <div
          className="px-2 pb-4 pt-1 text-center text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(copyright) }}
        />
      )}
    </aside>
  )
}
