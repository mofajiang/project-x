import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'
import { runMigrations } from './db-migrate'

const DEFAULT_VISITOR_STATS_DISPLAY = '["总访问","今日访问","7 日访问","14 日访问","国家数","精确坐标","国家/省份落点","最近时间"]'

function toSafeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function toSafeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' || typeof value === 'bigint') return Number(value) !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

function sanitizeBigIntDeep<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') {
        const num = Number(v)
        return Number.isSafeInteger(num) ? num : v.toString()
      }
      return v
    })
  )
}


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

export type AiModelConfig = {
  enableCustomAiModel: boolean
  aiModelProvider: string
  aiModelName: string
  aiModelBaseUrl: string
  aiModelApiKey: string
  aiModelMaxTokens: number
  aiModelTimeout: number
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
  enableAiDetection: boolean
  aiReviewStrength: 'lenient' | 'balanced' | 'strict'
  aiAutoApprove: boolean
  openrouterApiKey: string
  openrouterModel: string
  // 新 AI 模型字段
  enableCustomAiModel: boolean
  aiModelProvider: string
  aiModelName: string
  aiModelBaseUrl: string
  aiModelApiKey: string
  aiModelMaxTokens: number
  aiModelTimeout: number
  emailSubjectNewComment: string
  emailSubjectReply: string
  emailSubjectApproved: string
  emailSenderName: string
  socialX: string
  socialGithub: string
  socialEmail: string
  navItems: string
  siteLogo: string
  siteIcon: string
  rightPanelWidgets: string
  visitorGeoMode: 'offline' | 'ip9' | 'ipwho' | 'ipapi' | 'ipinfo' | 'ip-api' | 'geolocation-db' | 'custom' | string
  visitorGeoKey: string
  visitorGeoEndpoint: string
  visitorMapSource: string
  visitorStatsDisplay: string
  copyright: string
  defaultTheme: string
  customDomain: string
  storageDriver: 'local' | 's3' | 'smms' | string
  storageS3Endpoint: string
  storageS3Region: string
  storageS3Bucket: string
  storageS3AccessKeyId: string
  storageS3SecretAccessKey: string
  storageS3Prefix: string
  storageS3ForcePathStyle: boolean
  storagePublicBaseUrl: string
  storageSmmsToken: string
}

export const DEFAULT_NAV: NavItem[] = [
  { label: '首页', href: '/', icon: 'home' },
  { label: '归档', href: '/archive', icon: 'archive' },
  { label: '标签', href: '/tags', icon: 'tag' },
  { label: '友链', href: '/links', icon: 'link' },
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
  try { await runMigrations() } catch (e: any) { console.warn('[config] runMigrations:', e?.message) }
  // 一次 raw SQL 读取所有字段（含动态迁移列）
  let rows: any[] = []
  try {
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
       COALESCE(siteLogo,'') as siteLogo,
       COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
       COALESCE(visitorGeoMode,'offline') as visitorGeoMode, COALESCE(visitorGeoKey,'') as visitorGeoKey, COALESCE(visitorGeoEndpoint,'') as visitorGeoEndpoint,
       COALESCE(visitorMapSource,'carto_positron') as visitorMapSource,
      COALESCE(visitorStatsDisplay,'["总访问","今日访问","7 日访问","14 日访问","国家数","精确坐标","国家/省份落点","最近时间"]') as visitorStatsDisplay,
       COALESCE(defaultTheme,'dark') as defaultTheme,
        COALESCE(storageDriver,'local') as storageDriver,
        COALESCE(storageS3Endpoint,'') as storageS3Endpoint,
        COALESCE(storageS3Region,'auto') as storageS3Region,
        COALESCE(storageS3Bucket,'') as storageS3Bucket,
        COALESCE(storageS3AccessKeyId,'') as storageS3AccessKeyId,
        COALESCE(storageS3SecretAccessKey,'') as storageS3SecretAccessKey,
        COALESCE(storageS3Prefix,'uploads/') as storageS3Prefix,
        COALESCE(storageS3ForcePathStyle,0) as storageS3ForcePathStyle,
        COALESCE(storagePublicBaseUrl,'') as storagePublicBaseUrl,
        COALESCE(storageSmmsToken,'') as storageSmmsToken,
       COALESCE(aiModelApiKey,'') as aiModelApiKey, COALESCE(aiModelName,'') as aiModelName,
       COALESCE(aiModelProvider,'openrouter') as aiModelProvider,
       COALESCE(aiModelBaseUrl,'') as aiModelBaseUrl,
       COALESCE(aiModelMaxTokens,2000) as aiModelMaxTokens,
       COALESCE(aiModelTimeout,30) as aiModelTimeout,
       COALESCE(enableCustomAiModel,0) as enableCustomAiModel
       FROM SiteConfig WHERE id = 'singleton'`
    )
  } catch {}
  if (!rows.length) {
    try {
      await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO SiteConfig (id) VALUES ('singleton')`)
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT *, COALESCE(copyright,'') as copyright, COALESCE(siteIcon,'') as siteIcon,
         COALESCE(siteLogo,'') as siteLogo,
         COALESCE(navItems,'') as navItems, COALESCE(rightPanelWidgets,'') as rightPanelWidgets,
         COALESCE(visitorGeoMode,'offline') as visitorGeoMode, COALESCE(visitorGeoKey,'') as visitorGeoKey, COALESCE(visitorGeoEndpoint,'') as visitorGeoEndpoint,
         COALESCE(visitorMapSource,'carto_positron') as visitorMapSource,
         COALESCE(visitorStatsDisplay,'["总访问","今日访问","7 日访问","14 日访问","国家数","精确坐标","国家/省份落点","最近时间"]') as visitorStatsDisplay,
         COALESCE(defaultTheme,'dark') as defaultTheme,
         COALESCE(storageDriver,'local') as storageDriver,
         COALESCE(storageS3Endpoint,'') as storageS3Endpoint,
         COALESCE(storageS3Region,'auto') as storageS3Region,
         COALESCE(storageS3Bucket,'') as storageS3Bucket,
         COALESCE(storageS3AccessKeyId,'') as storageS3AccessKeyId,
         COALESCE(storageS3SecretAccessKey,'') as storageS3SecretAccessKey,
         COALESCE(storageS3Prefix,'uploads/') as storageS3Prefix,
         COALESCE(storageS3ForcePathStyle,0) as storageS3ForcePathStyle,
         COALESCE(storagePublicBaseUrl,'') as storagePublicBaseUrl,
         COALESCE(storageSmmsToken,'') as storageSmmsToken,
         COALESCE(aiModelApiKey,'') as aiModelApiKey, COALESCE(aiModelName,'') as aiModelName,
         COALESCE(aiModelProvider,'openrouter') as aiModelProvider,
         COALESCE(aiModelBaseUrl,'') as aiModelBaseUrl,
         COALESCE(aiModelMaxTokens,2000) as aiModelMaxTokens,
         COALESCE(aiModelTimeout,30) as aiModelTimeout,
         COALESCE(enableCustomAiModel,0) as enableCustomAiModel
         FROM SiteConfig WHERE id = 'singleton'`
      )
    } catch (e: any) {
      console.warn('[config] fetchSiteConfig fallback select:', e?.message)
      try {
        rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM SiteConfig WHERE id = 'singleton'`)
      } catch {}
    }
  }
  const config: any = sanitizeBigIntDeep(rows[0] || {})
  if (!config.navItems) config.navItems = JSON.stringify(DEFAULT_NAV)
  // 若已有导航里缺少友链项，自动插入（在关于之前）
  try {
    const navArr: NavItem[] = JSON.parse(config.navItems)
    if (Array.isArray(navArr) && !navArr.some(item => item.href === '/links')) {
      const aboutIdx = navArr.findIndex(item => item.href === '/about')
      const linksItem: NavItem = { label: '友链', href: '/links', icon: 'link' }
      if (aboutIdx >= 0) navArr.splice(aboutIdx, 0, linksItem)
      else navArr.push(linksItem)
      config.navItems = JSON.stringify(navArr)
    }
  } catch {}
  if (!config.rightPanelWidgets) config.rightPanelWidgets = JSON.stringify(DEFAULT_WIDGETS)
  if (!config.siteLogo) config.siteLogo = JSON.stringify(DEFAULT_SITE_LOGO)
  if (!config.siteIcon) config.siteIcon = ''
  if (!config.loginPath) config.loginPath = '/admin-login'
  if (!config.loginMode) config.loginMode = 'path'
  if (!config.secretClicks) config.secretClicks = 5
  if (!config.visitorGeoMode) config.visitorGeoMode = 'ip9'
  if (['xxapi', 'tencent', 'uapis'].includes(config.visitorGeoMode)) config.visitorGeoMode = 'custom'
  if (!['offline', 'ip9', 'ipwho', 'ipapi', 'ipinfo', 'ip-api', 'geolocation-db', 'custom'].includes(config.visitorGeoMode)) config.visitorGeoMode = 'ip9'
  if (!config.visitorGeoKey) config.visitorGeoKey = ''
  if (!config.visitorGeoEndpoint) config.visitorGeoEndpoint = ''
  if (!config.visitorStatsDisplay) config.visitorStatsDisplay = DEFAULT_VISITOR_STATS_DISPLAY
  if (config.showCommentIp === undefined || config.showCommentIp === null) config.showCommentIp = false
  if (config.commentApproval === undefined || config.commentApproval === null) config.commentApproval = true
  if (config.enableAiDetection === undefined || config.enableAiDetection === null) config.enableAiDetection = true
  if (config.aiAutoApprove === undefined || config.aiAutoApprove === null) config.aiAutoApprove = true
  if (!config.aiReviewStrength) config.aiReviewStrength = 'balanced'
  if (config.emailSubjectNewComment === undefined || config.emailSubjectNewComment === null) config.emailSubjectNewComment = ''
  if (config.emailSubjectReply === undefined || config.emailSubjectReply === null) config.emailSubjectReply = ''
  if (config.emailSubjectApproved === undefined || config.emailSubjectApproved === null) config.emailSubjectApproved = ''
  if (config.emailSenderName === undefined || config.emailSenderName === null) config.emailSenderName = ''
  
  // SQLite 存的是 0/1 整数，需转换为布尔值
  config.showCommentIp = toSafeBoolean(config.showCommentIp, false)
  config.commentApproval = toSafeBoolean(config.commentApproval, true)
  config.enableAiDetection = toSafeBoolean(config.enableAiDetection, true)
  config.aiAutoApprove = toSafeBoolean(config.aiAutoApprove, true)
  config.secretClicks = toSafeNumber(config.secretClicks, 5)
  if (typeof config.loginPath === 'string' && !config.loginPath.startsWith('/')) config.loginPath = `/${config.loginPath}`

  if (!config.copyright) config.copyright = ''
  if (!config.defaultTheme) config.defaultTheme = 'dark'
  if (!config.storageDriver) config.storageDriver = 'local'
  if (!config.storageS3Endpoint) config.storageS3Endpoint = ''
  if (!config.storageS3Region) config.storageS3Region = 'auto'
  if (!config.storageS3Bucket) config.storageS3Bucket = ''
  if (!config.storageS3AccessKeyId) config.storageS3AccessKeyId = ''
  if (!config.storageS3SecretAccessKey) config.storageS3SecretAccessKey = ''
  if (!config.storageS3Prefix) config.storageS3Prefix = 'uploads/'
  if (config.storagePublicBaseUrl === undefined || config.storagePublicBaseUrl === null) config.storagePublicBaseUrl = ''
  if (config.storageSmmsToken === undefined || config.storageSmmsToken === null) config.storageSmmsToken = ''
  config.storageS3ForcePathStyle = toSafeBoolean(config.storageS3ForcePathStyle, false)
  // 新 AI 模型字段默认值
  if (!config.aiModelApiKey) config.aiModelApiKey = ''
  if (!config.aiModelName) config.aiModelName = ''
  if (!config.aiModelProvider) config.aiModelProvider = 'openrouter'
  if (!config.aiModelBaseUrl) config.aiModelBaseUrl = ''
  if (!config.aiModelMaxTokens) config.aiModelMaxTokens = 2000
  if (!config.aiModelTimeout) config.aiModelTimeout = 30
  config.aiModelMaxTokens = toSafeNumber(config.aiModelMaxTokens, 2000)
  config.aiModelTimeout = toSafeNumber(config.aiModelTimeout, 30)
  config.enableCustomAiModel = toSafeBoolean(config.enableCustomAiModel, false)
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
