import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'
import { runMigrations } from './db-migrate'

export type NavItem = {
  label: string
  href: string
  icon: string
}

export type WidgetType = 'search' | 'about' | 'tags' | 'hotPosts' | 'custom' | 'links'

export type FriendLink = {
  label: string
  url: string
  desc?: string
  avatar?: string
}

export type RightPanelWidget = {
  type: WidgetType
  enabled: boolean
  title?: string   // 自定义标题（覆盖默认）
  content?: string // type=custom 时的内容
  links?: FriendLink[] // type=links 时的友情链接列表
}

export const DEFAULT_WIDGETS: RightPanelWidget[] = [
  { type: 'search',   enabled: true },
  { type: 'about',    enabled: true },
  { type: 'tags',     enabled: true },
  { type: 'hotPosts', enabled: true },
]

export function parseWidgets(raw: string | undefined | null): RightPanelWidget[] {
  try {
    const parsed = JSON.parse(raw || '')
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return DEFAULT_WIDGETS
}

export type SiteConfig = {
  id: string
  siteName: string
  siteDesc: string
  loginPath: string
  loginMode: string
  secretClicks: number
  commentApproval: boolean
  socialX: string
  socialGithub: string
  socialEmail: string
  navItems: string
  siteIcon: string
  rightPanelWidgets: string
  copyright: string
  defaultTheme: string
}

const DEFAULT_NAV: NavItem[] = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '归档', href: '/archive', icon: 'archive' },
  { label: '标签', href: '/tags', icon: 'tag' },
  { label: '关于', href: '/about', icon: 'user' },
]

export function parseNavItems(raw: string | undefined | null): NavItem[] {
  try {
    const parsed = JSON.parse(raw || '')
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return DEFAULT_NAV
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  await runMigrations()
  // 一次 raw SQL 读取所有字段（含动态迁移列）
  let rows: any[] = []
  try {
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
       COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
       COALESCE(defaultTheme,'dark') as defaultTheme
       FROM SiteConfig WHERE id = 'singleton'`
    )
  } catch {}
  if (!rows.length) {
    await prisma.siteConfig.create({ data: { id: 'singleton' } })
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
       COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
       COALESCE(defaultTheme,'dark') as defaultTheme
       FROM SiteConfig WHERE id = 'singleton'`
    )
  }
  const config: any = rows[0] || {}
  if (!config.navItems) config.navItems = JSON.stringify(DEFAULT_NAV)
  if (!config.rightPanelWidgets) config.rightPanelWidgets = JSON.stringify(DEFAULT_WIDGETS)
  if (!config.siteIcon) config.siteIcon = ''
  if (!config.copyright) config.copyright = ''
  if (!config.defaultTheme) config.defaultTheme = 'dark'
  return config as SiteConfig
}

export const getSiteConfig = unstable_cache(
  fetchSiteConfig,
  ['site-config'],
  { revalidate: 60, tags: ['site-config'] }
)

// 保存设置后调用此函数使缓存失效
export async function revalidateSiteConfig() {
  const { revalidateTag } = await import('next/cache')
  revalidateTag('site-config')
}
