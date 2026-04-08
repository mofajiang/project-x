import { Sidebar } from '@/components/layout/Sidebar'
import { RightPanel } from '@/components/layout/RightPanel'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { ScrollToTop } from '@/components/blog/ScrollToTop'
import { ComposeModal } from '@/components/blog/ComposeModal'
import { getSiteConfig, parseNavItems, parseSiteLogo, parseWidgets } from '@/lib/config'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig()
  const navItems = parseNavItems((config as any).navItems)
  const siteLogo = parseSiteLogo((config as any).siteLogo)
  const widgets = parseWidgets((config as any).rightPanelWidgets)
  const session = await getSession()
  const [topTags, hotPosts, approvedFriendLinks] = await Promise.all([
    prisma.tag.findMany({
      orderBy: { posts: { _count: 'desc' } },
      take: 8,
      select: { id: true, name: true, slug: true, _count: { select: { posts: true } } },
    }),
    prisma.post.findMany({
      where: { published: true },
      orderBy: [{ pinned: 'desc' }, { views: 'desc' }],
      take: 5,
      select: { id: true, title: true, slug: true, views: true },
    }),
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; url: string; description: string | null; favicon: string | null }>>(
      `SELECT id, name, url, description, favicon
       FROM FriendLink
       WHERE status = 'approved' AND COALESCE(showInSidebar, 1) = 1
       ORDER BY COALESCE(sortOrder, 0) DESC,
                CASE
                  WHEN approvedAt IS NULL THEN 0
                  WHEN typeof(approvedAt) = 'integer' THEN approvedAt
                  ELSE CAST(strftime('%s', approvedAt) AS INTEGER) * 1000
                END DESC`
    ),
  ])

  const mobileTopTags = topTags.map(tag => ({ id: tag.id, name: tag.name, slug: tag.slug, posts: tag._count.posts }))
  let avatar: string | null = null
  let displayName: string = ''
  let handle: string = session?.username || ''
  if (session) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { avatar: true, displayName: true, username: true },
      })
      if (user) {
        avatar = user.avatar || null
        displayName = user.displayName || ''
        handle = user.username || handle
      }
    } catch {}
  }
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* 移动端顶部 header */}
      <MobileHeader
        siteName={config.siteName}
        session={session}
        avatar={avatar}
        displayName={displayName}
        handle={handle}
        siteLogo={siteLogo}
        loginMode={config.loginMode}
        secretClicks={config.secretClicks}
        loginPath={config.loginPath}
        navItems={navItems}
        siteDesc={config.siteDesc}
        social={{ x: config.socialX, github: config.socialGithub, email: config.socialEmail }}
        widgets={widgets}
        copyright={(config as any).copyright || ''}
        topTags={mobileTopTags}
        hotPosts={hotPosts}
        approvedFriendLinks={approvedFriendLinks}
      />

      <div className="max-w-[1280px] mx-auto flex justify-center">
        {/* 左侧导航（桌面端） */}
        <div className="hidden md:flex w-[72px] xl:w-[240px] flex-shrink-0">
          <Sidebar siteName={config.siteName} siteLogo={siteLogo} loginMode={config.loginMode} secretClicks={config.secretClicks} loginPath={config.loginPath} navItems={navItems} session={session} avatar={avatar} displayName={displayName} handle={handle} />
        </div>
        {/* 主内容 */}
        <main className="w-full min-h-screen md:border-x pb-16 md:pb-0" style={{ borderColor: 'var(--border)', maxWidth: 600, minWidth: 0 }}>
          {children}
        </main>
        {/* 右侧面板（桌面端） */}
        <div className="hidden lg:flex w-[350px] flex-shrink-0">
          <RightPanel siteDesc={config.siteDesc} social={{ x: config.socialX, github: config.socialGithub, email: config.socialEmail }} widgets={widgets} copyright={(config as any).copyright || ''} />
        </div>
      </div>

      {/* 移动端底部 tab bar */}
      <MobileTabBar navItems={navItems} session={session} />

      {/* 回到顶部/首页 浮动按钮 */}
      <ScrollToTop />

      {/* 快速发文模态弹窗（登录后挂载） */}
      {session && <ComposeModal avatar={avatar} username={session.username} />}
    </div>
  )
}
