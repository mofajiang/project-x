import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { SearchBox } from './SearchBox'
import type { RightPanelWidget, FriendLink } from '@/lib/config'

const getTopTags = unstable_cache(
  () => prisma.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { posts: { _count: 'desc' } },
    take: 8,
  }),
  ['top-tags'],
  { revalidate: 300 }
)

const getHotPosts = unstable_cache(
  () => prisma.post.findMany({
    where: { published: true },
    orderBy: { views: 'desc' },
    take: 5,
    select: { id: true, title: true, slug: true, views: true },
  }),
  ['hot-posts'],
  { revalidate: 120 }
)

interface Props {
  siteDesc: string
  social: { x: string; github: string; email: string }
  widgets?: RightPanelWidget[]
  copyright?: string
}

const DEFAULT_TITLES: Record<string, string> = {
  about: '关于我',
  tags: '热门标签',
  hotPosts: '热门文章',
  links: '友情链接',
}

export async function RightPanel({ siteDesc, social, widgets = [], copyright = '' }: Props) {
  const enabledWidgets = widgets.filter(w => w.enabled)
  const needTags = enabledWidgets.some(w => w.type === 'tags')
  const needHotPosts = enabledWidgets.some(w => w.type === 'hotPosts')

  const [topTags, hotPosts] = await Promise.all([
    needTags ? getTopTags() : Promise.resolve([]),
    needHotPosts ? getHotPosts() : Promise.resolve([]),
  ])

  return (
    <aside className="w-[350px] sticky top-0 h-screen overflow-y-auto px-4 py-4 hidden lg:block" style={{ WebkitFontSmoothing: 'antialiased' }}>
      {enabledWidgets.map((widget, i) => {
        const title = widget.title || DEFAULT_TITLES[widget.type] || ''

        if (widget.type === 'search') {
          return <SearchBox key={i} />
        }

        if (widget.type === 'about') {
          if (!siteDesc && !social.x && !social.github && !social.email) return null
          return (
            <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="font-extrabold text-[20px] mb-2 px-4 pt-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              {siteDesc && <p className="text-sm leading-relaxed px-4" style={{ color: 'var(--text-secondary)' }}>{siteDesc}</p>}
              {(social.x || social.github || social.email) && (
                <div className="flex gap-2 mt-3 mb-3 flex-wrap px-4 pb-1">
                  {social.x && <a href={`https://x.com/${social.x}`} target="_blank" className="text-xs px-3 py-1 rounded-full font-bold transition-colors hover:opacity-80" style={{ background: 'var(--accent)', color: '#fff' }}>𝕏 @{social.x}</a>}
                  {social.github && <a href={`https://github.com/${social.github}`} target="_blank" className="text-xs px-3 py-1 rounded-full font-bold transition-colors hover:opacity-80" style={{ background: 'var(--accent)', color: '#fff' }}>GitHub</a>}
                  {social.email && <a href={`mailto:${social.email}`} className="text-xs px-3 py-1 rounded-full font-bold transition-colors hover:opacity-80" style={{ background: 'var(--accent)', color: '#fff' }}>邮件</a>}
                </div>
              )}
            </div>
          )
        }

        if (widget.type === 'tags') {
          if (!topTags.length) return null
          return (
            <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="font-extrabold text-[20px] px-4 pt-3 pb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <div className="flex flex-col">
                {topTags.map(tag => (
                  <a key={tag.id} href={`/tag/${tag.slug}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-normal" style={{ color: 'var(--text-secondary)' }}>标签</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>#{tag.name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tag._count.posts} 篇</span>
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
            <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="font-extrabold text-[20px] px-4 pt-3 pb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <div className="flex flex-col">
                {hotPosts.map((post, idx) => (
                  <a key={post.id} href={`/post/${post.slug}`} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5 group">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>热门 · 第 {idx + 1}</span>
                      <span className="text-sm font-bold truncate group-hover:underline" style={{ color: 'var(--text-primary)' }}>{post.title}</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{post.views} 次浏览</span>
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
            <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
              {title && <h2 className="font-extrabold text-[20px] px-4 pt-3 pb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>}
              <div className="text-sm leading-relaxed whitespace-pre-wrap px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{widget.content}</div>
            </div>
          )
        }

        if (widget.type === 'links') {
          const links: FriendLink[] = widget.links || []
          if (!links.length) return null
          return (
            <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
              <h2 className="font-extrabold text-[20px] px-4 pt-3 pb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <div className="flex flex-col">
                {links.map((link, idx) => (
                  <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 px-4 transition-colors hover:bg-white/5">
                    {/* 头像/首字母 */}
                    <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {link.avatar
                        ? <img src={link.avatar} alt={link.label} className="w-full h-full object-cover" />
                        : <span>{link.label[0]?.toUpperCase()}</span>}
                    </div>
                    {/* 名称 + 简介 */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{link.label}</span>
                      {link.desc && <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{link.desc}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        }

        return null
      })}

      {/* 版权信息 */}
      {copyright && (
        <div
          className="px-2 pt-1 pb-4 text-xs text-center leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: copyright }}
        />
      )}
    </aside>
  )
}
