import { Sidebar } from '@/components/layout/Sidebar'
import { RightPanel } from '@/components/layout/RightPanel'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { ScrollToTop } from '@/components/blog/ScrollToTop'
import { ComposeModal } from '@/components/blog/ComposeModal'
import { getSiteConfig, parseNavItems, parseWidgets } from '@/lib/config'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig()
  const navItems = parseNavItems((config as any).navItems)
  const widgets = parseWidgets((config as any).rightPanelWidgets)
  const session = await getSession()
  let avatar: string | null = null
  let displayName: string = ''
  let handle: string = session?.username || ''
  if (session) {
    try {
      // 一次查询获取所有用户字段
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT avatar, displayName, username FROM User WHERE id = ?`, session.userId
      )
      if (rows[0]) {
        avatar = rows[0].avatar || null
        displayName = rows[0].displayName || ''
        handle = rows[0].username || handle
      }
    } catch {}
  }
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* 移动端顶部 header */}
      <MobileHeader siteName={config.siteName} session={session} avatar={avatar} displayName={displayName} handle={handle} loginMode={config.loginMode} secretClicks={config.secretClicks} loginPath={config.loginPath} />

      <div className="max-w-[1280px] mx-auto flex justify-center">
        {/* 左侧导航（桌面端） */}
        <div className="hidden md:flex w-[72px] xl:w-[240px] flex-shrink-0">
          <Sidebar siteName={config.siteName} loginMode={config.loginMode} secretClicks={config.secretClicks} loginPath={config.loginPath} navItems={navItems} session={session} avatar={avatar} displayName={displayName} handle={handle} />
        </div>
        {/* 主内容 */}
        <main className="w-full min-h-screen border-x pb-16 md:pb-0" style={{ borderColor: 'var(--border)', maxWidth: 600, minWidth: 0 }}>
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
