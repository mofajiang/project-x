import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'
import { runMigrations } from './db-migrate'

export type NavItem = {
  label: string
  href: string
  icon: string
}

export type SiteLogoType = 'text' | 'image'

export type SiteLogo = {
  type: SiteLogoType
  value: string
}

export const DEFAULT_SITE_LOGO: SiteLogo = {
  type: 'text',
  value: '✕',
}

export function isImageSource(value: string) {
  const trimmed = value.trim()
  return /^(https?:\/\/|\/|data:)/i.test(trimmed)
}

export type WidgetType = 'search' | 'about' | 'tags' | 'hotPosts' | 'custom' | 'links' | 'carousel'

export type FriendLink = {
  label: string
  url: string
  desc?: string
  avatar?: string
}

export type CarouselSlideType = 'image' | 'text' | 'markdown'

export type CarouselSlide = {
  slideType?: CarouselSlideType // 默认 'image'
  // image 类型
  image?: string    // 图片 URL
  // 通用
  title?: string    // 标题
  desc?: string     // 描述 / 纯文本内容（text 类型）
  link?: string     // 跳转链接
  // markdown 类型
  markdown?: string // Markdown 内容
}

export type RightPanelWidget = {
  type: WidgetType
  enabled: boolean
  mobileVisible?: boolean   // 是否在手机端侧栏显示
  title?: string        // 自定义标题（覆盖默认）
  content?: string      // type=custom 时的内容
  links?: FriendLink[]  // type=links 时的友情链接列表
  slides?: CarouselSlide[] // type=carousel 时的轮播内容
  interval?: number     // type=carousel 自动播放间隔（毫秒），默认 3000
}

export const DEFAULT_WIDGETS: RightPanelWidget[] = [
  { type: 'search',   enabled: true, mobileVisible: false },
  { type: 'about',    enabled: true, mobileVisible: true },
  { type: 'tags',     enabled: true, mobileVisible: true },
  { type: 'hotPosts', enabled: true, mobileVisible: true },
]

function normalizeWidget(widget: RightPanelWidget): RightPanelWidget {
  return {
    ...widget,
    mobileVisible: widget.mobileVisible ?? widget.type !== 'search',
  }
}

export function parseWidgets(raw: string | undefined | null): RightPanelWidget[] {
  try {
    const parsed = JSON.parse(raw || '')
    if (Array.isArray(parsed)) return parsed.map(item => normalizeWidget(item as RightPanelWidget))
  } catch {}
  return DEFAULT_WIDGETS.map(normalizeWidget)
}

export type SiteConfig = {
  id: string
  siteName: string
  siteDesc: string
  loginPath: string
  loginMode: string
  secretClicks: number
  commentApproval: boolean
  showCommentIp: boolean
  socialX: string
  socialGithub: string
  socialEmail: string
  navItems: string
  siteLogo: string
  siteIcon: string
  rightPanelWidgets: string
  visitorGeoMode: 'offline' | 'ip9' | 'tencent' | 'ipstack' | 'ipip' | 'custom' | string
  visitorGeoKey: string
  visitorGeoEndpoint: string
  copyright: string
  defaultTheme: string
  customDomain: string
}

export const DEFAULT_NAV: NavItem[] = [
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

export function parseSiteLogo(raw: string | undefined | null): SiteLogo {
  if (!raw) return DEFAULT_SITE_LOGO
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string') {
      if (parsed.type === 'text' || parsed.type === 'image') {
        return { type: parsed.type, value: parsed.value }
      }
      return { type: 'text', value: parsed.value }
    }
  } catch {
    return { type: 'text', value: raw }
  }
  return DEFAULT_SITE_LOGO
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  await runMigrations()
  // 一次 raw SQL 读取所有字段（含动态迁移列）
  let rows: any[] = []
  try {
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
       COALESCE(siteLogo,'') as siteLogo,
       COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
       COALESCE(visitorGeoMode,'offline') as visitorGeoMode, COALESCE(visitorGeoKey,'') as visitorGeoKey, COALESCE(visitorGeoEndpoint,'') as visitorGeoEndpoint,
       COALESCE(defaultTheme,'dark') as defaultTheme
       FROM SiteConfig WHERE id = 'singleton'`
    )
  } catch {}
  if (!rows.length) {
    await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO SiteConfig (id) VALUES ('singleton')`)
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
       COALESCE(siteLogo,'') as siteLogo,
       COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
       COALESCE(visitorGeoMode,'offline') as visitorGeoMode, COALESCE(visitorGeoKey,'') as visitorGeoKey, COALESCE(visitorGeoEndpoint,'') as visitorGeoEndpoint,
       COALESCE(defaultTheme,'dark') as defaultTheme
       FROM SiteConfig WHERE id = 'singleton'`
    )
  }
  const config: any = rows[0] || {}
  if (!config.navItems) config.navItems = JSON.stringify(DEFAULT_NAV)
  if (!config.rightPanelWidgets) config.rightPanelWidgets = JSON.stringify(DEFAULT_WIDGETS)
  if (!config.siteLogo) config.siteLogo = JSON.stringify(DEFAULT_SITE_LOGO)
  if (!config.siteIcon) config.siteIcon = ''
  if (!config.visitorGeoMode) config.visitorGeoMode = 'ip9'
  if (['tencent', 'ipstack', 'ipip'].includes(config.visitorGeoMode)) config.visitorGeoMode = 'ip9'
  if (!config.visitorGeoKey) config.visitorGeoKey = ''
  if (!config.visitorGeoEndpoint) config.visitorGeoEndpoint = ''
  if (config.showCommentIp === undefined || config.showCommentIp === null) config.showCommentIp = false
  if (!config.copyright) config.copyright = ''
  if (!config.defaultTheme) config.defaultTheme = 'dark'
  return config as SiteConfig
}

export const getSiteConfig = unstable_cache(
  fetchSiteConfig,
  ['site-config'],
  { revalidate: 300, tags: ['site-config'] }
)

// 保存设置后调用此函数使缓存失效
export async function revalidateSiteConfig() {
  const { revalidateTag, revalidatePath } = await import('next/cache')
  revalidateTag('site-config')
  // 同时刷新所有前台页面，确保右侧栏立即生效
  revalidatePath('/', 'layout')
}
