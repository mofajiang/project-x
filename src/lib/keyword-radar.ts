import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { AI_CONFIG_SELECT, callAi, rowToAiFullConfig } from '@/lib/ai-call'
import {
  appendKeywordRadarLog,
  finishKeywordRadarLog,
  getKeywordRadarLogState,
  startKeywordRadarLog,
  type KeywordRadarLogState,
} from '@/lib/keyword-radar-log'
import { slugify } from '@/lib/utils'
import { syslog } from '@/lib/syslog'
import { revalidateTag } from 'next/cache'

type KeywordRadarRow = Record<string, unknown>

export const RADAR_SOURCES = [
  { id: 'google', label: 'Google News', region: '国际', type: 'rss' },
  { id: 'bing', label: 'Bing News', region: '国际', type: 'rss' },
  { id: 'baidu', label: '百度资讯', region: '中国', type: 'rss' },
  { id: 'yahoo', label: 'Yahoo News', region: '国际', type: 'rss' },
  { id: 'sogou', label: '搜狗资讯', region: '中国', type: 'html' },
  { id: 'duckduckgo', label: 'DuckDuckGo', region: '国际', type: 'html' },
  { id: 'yandex', label: 'Yandex News', region: '俄/国际', type: 'html' },
] as const

export type RadarSourceId = (typeof RADAR_SOURCES)[number]['id']

export type KeywordRadarConfig = {
  enabled: boolean
  keywords: string[]
  tags: string[]
  extraFeeds: string[]
  includeDomains: string[]
  excludeDomains: string[]
  scheduleMinutes: number
  autoPublish: boolean
  useAi: boolean
  prompt: string
  lastRunAt: string
  lastStatus: string
  lastMessage: string
  lastPostId: string
  maxItems: number
  keepDays: number
  sources: RadarSourceId[]
  customSourceTemplates: Array<{ name: string; urlTemplate: string }>
}

export type KeywordRadarSeenItem = {
  hash: string
  digestDate: string
  keywords: string[]
  title: string
  link: string
  summary: string
  source: string
  itemPublishedAt: string
  postId: string
  createdAt: string
}

export type KeywordRadarStatus = {
  config: KeywordRadarConfig
  recentItems: KeywordRadarSeenItem[]
  totalSeen: number
  logs: KeywordRadarLogState
}

export type KeywordRadarRunResult = {
  ok: boolean
  skipped?: boolean
  message: string
  matchedCount: number
  newCount: number
  digestDate: string
  postId?: string
}

type FeedItem = {
  title: string
  link: string
  summary: string
  publishedAt: string
  source: string
  keywords: string[]
}

const DEFAULT_CONFIG: KeywordRadarConfig = {
  enabled: false,
  keywords: [],
  tags: ['日报'],
  extraFeeds: [],
  includeDomains: [],
  excludeDomains: [],
  scheduleMinutes: 180,
  autoPublish: true,
  useAi: true,
  prompt: '',
  lastRunAt: '',
  lastStatus: '',
  lastMessage: '',
  lastPostId: '',
  maxItems: 12,
  keepDays: 14,
  sources: ['google'],
  customSourceTemplates: [],
}

const FETCH_TIMEOUT_MS = 8000
const MAX_FEED_ITEMS = 12
const MAX_SEEN_ROWS = 800

function parseArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index)
  }
  if (typeof input !== 'string' || !input.trim()) return []
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) return parseArray(parsed)
  } catch {}
  return input
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
}

function rowToConfig(row: KeywordRadarRow | undefined): KeywordRadarConfig {
  if (!row) return DEFAULT_CONFIG
  return {
    enabled: Boolean(Number(row.keywordRadarEnabled) || 0),
    keywords: parseArray(row.keywordRadarKeywords),
    tags: parseArray(row.keywordRadarTags),
    extraFeeds: parseArray(row.keywordRadarExtraFeeds),
    includeDomains: parseArray(row.keywordRadarIncludeDomains),
    excludeDomains: parseArray(row.keywordRadarExcludeDomains),
    scheduleMinutes: Math.max(15, Number(row.keywordRadarScheduleMinutes) || DEFAULT_CONFIG.scheduleMinutes),
    autoPublish: Boolean(Number(row.keywordRadarAutoPublish) || 0),
    useAi: Boolean(Number(row.keywordRadarUseAi) || 0),
    prompt: String(row.keywordRadarPrompt || ''),
    lastRunAt: String(row.keywordRadarLastRunAt || ''),
    lastStatus: String(row.keywordRadarLastStatus || ''),
    lastMessage: String(row.keywordRadarLastMessage || ''),
    lastPostId: String(row.keywordRadarLastPostId || ''),
    maxItems: Math.max(3, Math.min(30, Number(row.keywordRadarMaxItems) || DEFAULT_CONFIG.maxItems)),
    keepDays: Math.max(1, Math.min(90, Number(row.keywordRadarKeepDays) || DEFAULT_CONFIG.keepDays)),
    sources: ((arr) => (arr.length ? arr : DEFAULT_CONFIG.sources))(
      (parseArray(row.keywordRadarSources) as RadarSourceId[]).filter((s) => RADAR_SOURCES.some((def) => def.id === s))
    ),
    customSourceTemplates: parseCustomSourceTemplates(row.keywordRadarCustomSourceTemplates),
  }
}

function parseCustomSourceTemplates(input: unknown): Array<{ name: string; urlTemplate: string }> {
  if (!input) return []
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t: unknown) => typeof t === 'object' && t && 'name' in t && 'urlTemplate' in t)
      .map((t: { name: string; urlTemplate: string }) => ({
        name: String(t.name || '').slice(0, 50),
        urlTemplate: String(t.urlTemplate || '').slice(0, 500),
      }))
      .filter((t) => t.name && t.urlTemplate.includes('{keyword}'))
  } catch {
    return []
  }
}

function buildGoogleNewsFeedUrl(keyword: string) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
}

function buildBingNewsFeedUrl(keyword: string) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss&mkt=zh-CN`
}

function buildBaiduNewsFeedUrl(keyword: string) {
  return `https://news.baidu.com/ns?word=${encodeURIComponent(keyword)}&tn=newsrss&sr=0&cl=2&rn=20&ct=0`
}

function buildYahooNewsFeedUrl(keyword: string) {
  return `https://news.search.yahoo.com/rss?p=${encodeURIComponent(keyword)}`
}

function buildSogouNewsUrl(keyword: string) {
  return `https://news.sogou.com/news?query=${encodeURIComponent(keyword)}&sort=0`
}

function buildDuckDuckGoNewsUrl(keyword: string) {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}+news`
}

function buildYandexNewsUrl(keyword: string) {
  return `https://newssearch.yandex.ru/yandsearch?text=${encodeURIComponent(keyword)}&rpt=nnews2`
}

/**
 * Parse news results from Sogou HTML search page.
 */
function parseSogouHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Sogou news results use <h3><a href="...">title</a></h3> with class "vrTitle"
  const blockRe = /<h3[^>]*class="[^"]*vr[Tt]itle[^"]*"[^>]*>[\s\S]*?<\/h3>[\s\S]*?(?=<h3|<div\s+id="pagebar"|$)/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = m[0]
    const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue
    const link = linkMatch[1]
    const title = linkMatch[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title || !link) continue
    const descMatch =
      block.match(/<p[^>]*class="[^"]*star-wiki[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      block.match(/<div[^>]*class="[^"]*rb[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const summary = descMatch
      ? descMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt: new Date().toISOString(),
      source: '搜狗资讯',
      keywords: [keyword],
    })
  }
  // Fallback: generic <a> with newTitle class
  if (items.length === 0) {
    const fallbackRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fallbackRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const title = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!title || title.length < 6 || !link.startsWith('http')) continue
      if (link.includes('sogou.com') && !link.includes('/link?')) continue
      items.push({
        title,
        link,
        summary: '',
        publishedAt: new Date().toISOString(),
        source: '搜狗资讯',
        keywords: [keyword],
      })
    }
  }
  return items
}

/**
 * Parse news results from DuckDuckGo HTML lite page.
 */
function parseDuckDuckGoHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // DDG HTML lite uses <a class="result__a" href="...">title</a>
  const resultRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = resultRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    let link = m[1]
    const title = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title || !link) continue
    // DDG sometimes wraps links in a redirect
    const uddg = link.match(/uddg=([^&]+)/)
    if (uddg) {
      try {
        link = decodeURIComponent(uddg[1])
      } catch {
        /* keep original */
      }
    }
    items.push({
      title,
      link,
      summary: '',
      publishedAt: new Date().toISOString(),
      source: 'DuckDuckGo',
      keywords: [keyword],
    })
  }
  // Fallback: any <a> with class containing "result"
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const title = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!title || title.length < 6 || link.includes('duckduckgo.com')) continue
      items.push({
        title,
        link,
        summary: '',
        publishedAt: new Date().toISOString(),
        source: 'DuckDuckGo',
        keywords: [keyword],
      })
    }
  }
  return items
}

/**
 * Parse news results from Yandex News search page.
 */
function parseYandexHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Yandex news results: <a class="mg-snippet__url" href="...">
  const re =
    /<a[^>]+class="[^"]*snippet[^"]*"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?(?=<a[^>]+class="[^"]*snippet|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const link = m[1]
    const block = m[0]
    const titleMatch = block.match(/<[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
    if (!title || !link.startsWith('http')) continue
    items.push({
      title,
      link,
      summary: '',
      publishedAt: new Date().toISOString(),
      source: 'Yandex News',
      keywords: [keyword],
    })
  }
  // Fallback
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/(?!yandex\.)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const title = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!title || title.length < 6) continue
      items.push({
        title,
        link,
        summary: '',
        publishedAt: new Date().toISOString(),
        source: 'Yandex News',
        keywords: [keyword],
      })
    }
  }
  return items
}

function getTagText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return ''
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function toSummary(raw: string, maxLen = 160) {
  const text = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

function normalizeKeyword(text: string) {
  return text.trim().toLowerCase()
}

function hashItem(item: Pick<FeedItem, 'link' | 'title'>) {
  return crypto.createHash('sha1').update(`${item.link}::${item.title}`).digest('hex')
}

function matchesDomainFilters(link: string, config: KeywordRadarConfig) {
  let host = ''
  try {
    host = new URL(link).host.toLowerCase()
  } catch {
    return false
  }
  const includeDomains = config.includeDomains.map((item) => item.toLowerCase())
  const excludeDomains = config.excludeDomains.map((item) => item.toLowerCase())
  if (excludeDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return false
  if (includeDomains.length === 0) return true
  return includeDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

function plainText(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateLabel(dateKey: string) {
  return dateKey.replace(/-/g, '.')
}

function makeDigestTitle(config: KeywordRadarConfig, dateKey: string) {
  const joined = config.keywords.slice(0, 3).join(' / ')
  return `${formatDateLabel(dateKey)} ${joined || '关键词'} 资讯日报`
}

function makeDigestMarker(dateKey: string) {
  return `<!-- keyword-radar:${dateKey} -->`
}

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
]

function randomUserAgent() {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)]
}

async function fetchXml(url: string, retries = 1): Promise<string> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`抓取失败 ${res.status}`)
      return await res.text()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw lastError!
}

async function fetchFeedByKeyword(keyword: string, sourceId: RadarSourceId = 'google'): Promise<FeedItem[]> {
  const rssUrlMap: Partial<Record<RadarSourceId, string>> = {
    google: buildGoogleNewsFeedUrl(keyword),
    bing: buildBingNewsFeedUrl(keyword),
    baidu: buildBaiduNewsFeedUrl(keyword),
    yahoo: buildYahooNewsFeedUrl(keyword),
  }
  const htmlUrlMap: Partial<Record<RadarSourceId, string>> = {
    sogou: buildSogouNewsUrl(keyword),
    duckduckgo: buildDuckDuckGoNewsUrl(keyword),
    yandex: buildYandexNewsUrl(keyword),
  }
  const sourceLabel: Record<RadarSourceId, string> = {
    google: 'Google News',
    bing: 'Bing News',
    baidu: '百度资讯',
    yahoo: 'Yahoo News',
    sogou: '搜狗资讯',
    duckduckgo: 'DuckDuckGo',
    yandex: 'Yandex News',
  }

  // HTML-based sources
  if (htmlUrlMap[sourceId]) {
    const html = await fetchXml(htmlUrlMap[sourceId]!)
    const htmlParsers: Partial<Record<RadarSourceId, (h: string, kw: string) => FeedItem[]>> = {
      sogou: parseSogouHtml,
      duckduckgo: parseDuckDuckGoHtml,
      yandex: parseYandexHtml,
    }
    const parser = htmlParsers[sourceId]
    return parser ? parser(html, keyword) : []
  }

  // RSS-based sources
  const xml = await fetchXml(rssUrlMap[sourceId] || buildGoogleNewsFeedUrl(keyword))
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
  const items: FeedItem[] = []
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = match[1]
    const title = getTagText(block, 'title')
    const link = getTagText(block, 'link') || (block.match(/<link>([^<]+)<\/link>/i)?.[1] ?? '')
    const summary = getTagText(block, 'description') || getTagText(block, 'summary')
    const publishedAt = getTagText(block, 'pubDate') || getTagText(block, 'published') || getTagText(block, 'updated')
    const source = getTagText(block, 'source') || sourceLabel[sourceId]
    if (!title || !link) continue
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      source,
      keywords: [keyword],
    })
  }
  return items
}

async function fetchCustomFeed(feedUrl: string, keywords: string[]): Promise<FeedItem[]> {
  const xml = await fetchXml(feedUrl)
  const itemRe = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/gi
  const items: FeedItem[] = []
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = match[2]
    const title = getTagText(block, 'title')
    const link =
      getTagText(block, 'link') ||
      (block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? '') ||
      (block.match(/<link>([^<]+)<\/link>/i)?.[1] ?? '')
    const summary = getTagText(block, 'description') || getTagText(block, 'summary') || getTagText(block, 'content')
    const publishedAt = getTagText(block, 'pubDate') || getTagText(block, 'published') || getTagText(block, 'updated')
    const haystack = normalizeKeyword(`${title} ${summary}`)
    const matched = keywords.filter((keyword) => haystack.includes(normalizeKeyword(keyword)))
    if (!title || !link || matched.length === 0) continue
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      source: new URL(feedUrl).host,
      keywords: matched,
    })
  }
  return items
}

async function ensureSiteConfigRow() {
  await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO SiteConfig (id) VALUES ('singleton')`)
}

async function setLastRun(fields: {
  lastRunAt?: string
  lastStatus?: string
  lastMessage?: string
  lastPostId?: string
}) {
  const updates: string[] = []
  const params: unknown[] = []
  if (fields.lastRunAt !== undefined) {
    updates.push('keywordRadarLastRunAt = ?')
    params.push(fields.lastRunAt)
  }
  if (fields.lastStatus !== undefined) {
    updates.push('keywordRadarLastStatus = ?')
    params.push(fields.lastStatus)
  }
  if (fields.lastMessage !== undefined) {
    updates.push('keywordRadarLastMessage = ?')
    params.push(fields.lastMessage)
  }
  if (fields.lastPostId !== undefined) {
    updates.push('keywordRadarLastPostId = ?')
    params.push(fields.lastPostId)
  }
  if (updates.length === 0) return
  await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET ${updates.join(', ')} WHERE id = 'singleton'`, ...params)
}

export async function getKeywordRadarConfig(): Promise<KeywordRadarConfig> {
  await runMigrations()
  await ensureSiteConfigRow()
  const rows = await prisma.$queryRawUnsafe<KeywordRadarRow[]>(
    `SELECT
      COALESCE(keywordRadarEnabled, 0) as keywordRadarEnabled,
      COALESCE(keywordRadarKeywords, '') as keywordRadarKeywords,
      COALESCE(keywordRadarTags, '') as keywordRadarTags,
      COALESCE(keywordRadarExtraFeeds, '') as keywordRadarExtraFeeds,
      COALESCE(keywordRadarIncludeDomains, '') as keywordRadarIncludeDomains,
      COALESCE(keywordRadarExcludeDomains, '') as keywordRadarExcludeDomains,
      COALESCE(keywordRadarScheduleMinutes, 180) as keywordRadarScheduleMinutes,
      COALESCE(keywordRadarAutoPublish, 1) as keywordRadarAutoPublish,
      COALESCE(keywordRadarUseAi, 1) as keywordRadarUseAi,
      COALESCE(keywordRadarPrompt, '') as keywordRadarPrompt,
      COALESCE(keywordRadarLastRunAt, '') as keywordRadarLastRunAt,
      COALESCE(keywordRadarLastStatus, '') as keywordRadarLastStatus,
      COALESCE(keywordRadarLastMessage, '') as keywordRadarLastMessage,
      COALESCE(keywordRadarLastPostId, '') as keywordRadarLastPostId,
      COALESCE(keywordRadarMaxItems, 12) as keywordRadarMaxItems,
      COALESCE(keywordRadarKeepDays, 14) as keywordRadarKeepDays,
      COALESCE(keywordRadarSources, '["google"]') as keywordRadarSources,
      COALESCE(keywordRadarCustomSourceTemplates, '[]') as keywordRadarCustomSourceTemplates
     FROM SiteConfig WHERE id = 'singleton'`
  )
  return rowToConfig(rows[0])
}

export async function saveKeywordRadarConfig(input: Partial<KeywordRadarConfig>) {
  await runMigrations()
  await ensureSiteConfigRow()
  const current = await getKeywordRadarConfig()
  const next: KeywordRadarConfig = {
    ...current,
    ...input,
    keywords: input.keywords ? parseArray(input.keywords) : current.keywords,
    tags: input.tags ? parseArray(input.tags) : current.tags,
    extraFeeds: input.extraFeeds ? parseArray(input.extraFeeds) : current.extraFeeds,
    includeDomains: input.includeDomains ? parseArray(input.includeDomains) : current.includeDomains,
    excludeDomains: input.excludeDomains ? parseArray(input.excludeDomains) : current.excludeDomains,
    sources: input.sources
      ? (parseArray(input.sources) as RadarSourceId[]).filter((s) => RADAR_SOURCES.some((d) => d.id === s))
      : current.sources,
    customSourceTemplates:
      input.customSourceTemplates !== undefined
        ? parseCustomSourceTemplates(input.customSourceTemplates)
        : current.customSourceTemplates,
    scheduleMinutes: Math.max(15, Number(input.scheduleMinutes ?? current.scheduleMinutes) || 180),
    maxItems: Math.max(3, Math.min(30, Number(input.maxItems ?? current.maxItems) || 12)),
    keepDays: Math.max(1, Math.min(90, Number(input.keepDays ?? current.keepDays) || 14)),
  }
  await prisma.$executeRawUnsafe(
    `UPDATE SiteConfig SET
      keywordRadarEnabled = ?,
      keywordRadarKeywords = ?,
      keywordRadarTags = ?,
      keywordRadarExtraFeeds = ?,
      keywordRadarIncludeDomains = ?,
      keywordRadarExcludeDomains = ?,
      keywordRadarScheduleMinutes = ?,
      keywordRadarAutoPublish = ?,
      keywordRadarUseAi = ?,
      keywordRadarPrompt = ?,
      keywordRadarMaxItems = ?,
      keywordRadarKeepDays = ?,
      keywordRadarSources = ?,
      keywordRadarCustomSourceTemplates = ?
     WHERE id = 'singleton'`,
    next.enabled ? 1 : 0,
    JSON.stringify(next.keywords),
    JSON.stringify(next.tags),
    JSON.stringify(next.extraFeeds),
    JSON.stringify(next.includeDomains),
    JSON.stringify(next.excludeDomains),
    next.scheduleMinutes,
    next.autoPublish ? 1 : 0,
    next.useAi ? 1 : 0,
    next.prompt,
    next.maxItems,
    next.keepDays,
    JSON.stringify(next.sources),
    JSON.stringify(next.customSourceTemplates)
  )
  return getKeywordRadarConfig()
}

async function getRecentItems(limit = 20): Promise<KeywordRadarSeenItem[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT hash, digestDate, keywords, title, link, summary, source, itemPublishedAt, postId, createdAt
     FROM KeywordRadarSeen
     ORDER BY createdAt DESC
     LIMIT ?`,
    limit
  )
  return rows.map((row) => ({
    hash: String(row.hash || ''),
    digestDate: String(row.digestDate || ''),
    keywords: parseArray(row.keywords),
    title: String(row.title || ''),
    link: String(row.link || ''),
    summary: String(row.summary || ''),
    source: String(row.source || ''),
    itemPublishedAt: String(row.itemPublishedAt || ''),
    postId: String(row.postId || ''),
    createdAt: String(row.createdAt || ''),
  }))
}

export async function getKeywordRadarStatus(): Promise<KeywordRadarStatus> {
  await runMigrations()
  await ensureSiteConfigRow()
  const [config, recentItems, totalRows] = await Promise.all([
    getKeywordRadarConfig(),
    getRecentItems(),
    prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM KeywordRadarSeen`),
  ])
  return {
    config,
    recentItems,
    totalSeen: Number(totalRows[0]?.cnt || 0),
    logs: getKeywordRadarLogState(),
  }
}

async function getNewItems(items: FeedItem[]) {
  if (items.length === 0) return [] as FeedItem[]
  const hashes = items.map((item) => hashItem(item))
  const placeholders = hashes.map(() => '?').join(', ')
  const existing = await prisma.$queryRawUnsafe<{ hash: string }[]>(
    `SELECT hash FROM KeywordRadarSeen WHERE hash IN (${placeholders})`,
    ...hashes
  )
  const existingSet = new Set(existing.map((row) => row.hash))
  return items.filter((item) => !existingSet.has(hashItem(item)))
}

function fallbackDigestMarkdown(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const marker = makeDigestMarker(dateKey)
  const keywordLine = config.keywords.length ? config.keywords.join('、') : '未设置关键词'
  const sections = items
    .slice(0, config.maxItems)
    .map((item, index) => {
      const keywordText = item.keywords.join(' / ')
      return [
        `### ${index + 1}. ${item.title}`,
        '',
        `- 匹配关键词：${keywordText}`,
        `- 来源：${item.source || '未知来源'}`,
        `- 发布时间：${item.publishedAt ? item.publishedAt.replace('T', ' ').slice(0, 16) : '未知'}`,
        item.summary ? `- 摘要：${item.summary}` : '',
        `- 原文：${item.link}`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  return [
    marker,
    `# ${formatDateLabel(dateKey)} 关键词资讯日报`,
    '',
    `本日报根据以下关键词自动汇总生成：${keywordLine}。`,
    '',
    '## 今日摘要',
    '',
    `共发现 ${items.length} 条新内容，以下为自动整理结果。`,
    '',
    '## 重点内容',
    '',
    sections,
  ].join('\n')
}

async function aiDigestMarkdown(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${AI_CONFIG_SELECT} FROM SiteConfig WHERE id = 'singleton'`
  )
  const cfg = rowToAiFullConfig(rows[0] || {})
  if (!cfg.groqApiKey && !cfg.openrouterApiKey && !cfg.aiModelApiKey) {
    return fallbackDigestMarkdown(items, config, dateKey)
  }

  const marker = makeDigestMarker(dateKey)
  const payload = items
    .slice(0, config.maxItems)
    .map((item, index) => {
      return [
        `${index + 1}. 标题：${item.title}`,
        `关键词：${item.keywords.join(' / ')}`,
        `来源：${item.source}`,
        `发布时间：${item.publishedAt}`,
        `摘要：${item.summary || '无'}`,
        `原文：${item.link}`,
      ].join('\n')
    })
    .join('\n\n')

  const systemPrompt = `你是一位中文科技/行业编辑。请把输入的新闻线索整理成一篇适合博客发布的 Markdown 日报。
要求：
1. 使用中文输出。
2. 文章结构清晰，包含标题、导语、分节小标题、要点列表。
3. 每条信息都保留原文链接。
4. 不要编造未提供的事实，不要扩展成大段空话。
5. 不输出 YAML，不输出代码块围栏。
6. 文风简洁、像站长日报。
7. 第一行必须保留这个标记且不要改动：${marker}`

  const userPrompt = `${config.prompt ? `${config.prompt}\n\n` : ''}关键词：${config.keywords.join('、')}\n标签：${config.tags.join('、')}\n日期：${formatDateLabel(dateKey)}\n\n线索如下：\n\n${payload}`

  try {
    const result = await callAi(
      'postPolish',
      cfg,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 3200, temperature: 0.45 }
    )
    return result && result.includes(marker) ? result : `${marker}\n\n${result}`
  } catch {
    return fallbackDigestMarkdown(items, config, dateKey)
  }
}

async function pruneSeenRows(keepDays: number) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM KeywordRadarSeen WHERE createdAt < datetime('now', '-' || ? || ' day')`,
    keepDays
  )
  const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM KeywordRadarSeen`)
  const total = Number(rows[0]?.cnt || 0)
  if (total > MAX_SEEN_ROWS) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM KeywordRadarSeen WHERE hash IN (
         SELECT hash FROM KeywordRadarSeen ORDER BY createdAt ASC LIMIT ?
       )`,
      total - MAX_SEEN_ROWS
    )
  }
}

async function upsertDailyDigest(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const marker = makeDigestMarker(dateKey)
  const title = makeDigestTitle(config, dateKey)
  const allRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT hash, keywords, title, link, summary, source, itemPublishedAt
     FROM KeywordRadarSeen WHERE digestDate = ? ORDER BY itemPublishedAt DESC, createdAt DESC`,
    dateKey
  )
  const allItems: FeedItem[] = allRows.map((row) => ({
    title: String(row.title || ''),
    link: String(row.link || ''),
    summary: String(row.summary || ''),
    source: String(row.source || ''),
    publishedAt: String(row.itemPublishedAt || ''),
    keywords: parseArray(row.keywords),
  }))
  const digestItems = allItems.length > 0 ? allItems.slice(0, config.maxItems) : items.slice(0, config.maxItems)
  const content = config.useAi
    ? await aiDigestMarkdown(digestItems, config, dateKey)
    : fallbackDigestMarkdown(digestItems, config, dateKey)
  const excerpt = plainText(content).slice(0, 160)
  const tagNames = config.tags.length ? config.tags : ['日报']
  const existing = await prisma.$queryRawUnsafe<{ id: string; published: number; publishedAt: string | null }[]>(
    `SELECT id, published, publishedAt FROM Post WHERE content LIKE ? ORDER BY createdAt DESC LIMIT 1`,
    `%${marker}%`
  )
  const authorRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM User ORDER BY createdAt ASC LIMIT 1`
  )
  const authorId = authorRows[0]?.id
  if (!authorId) throw new Error('未找到可用作者，无法自动发帖')

  if (existing[0]?.id) {
    await prisma.tagsOnPosts.deleteMany({ where: { postId: existing[0].id } })
    await prisma.post.update({
      where: { id: existing[0].id },
      data: {
        title,
        content,
        excerpt,
        published: config.autoPublish,
        publishedAt: config.autoPublish
          ? existing[0].publishedAt
            ? new Date(existing[0].publishedAt)
            : new Date()
          : null,
        tags: {
          create: tagNames.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { slug: slugify(tagName) },
                create: { name: tagName, slug: slugify(tagName) },
              },
            },
          })),
        },
      },
    })
    return existing[0].id
  }

  const rows = await prisma.$queryRawUnsafe<{ nextId: number }[]>(
    `SELECT COALESCE(MAX(publicId), 0) + 1 as nextId FROM Post`
  )
  const publicId = Number(rows[0]?.nextId) || 1
  const post = await prisma.post.create({
    data: {
      publicId,
      title,
      slug: `${slugify(title)}-${dateKey}`,
      content,
      excerpt,
      published: config.autoPublish,
      publishedAt: config.autoPublish ? new Date() : null,
      authorId,
      tags: {
        create: tagNames.map((tagName) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tagName) },
              create: { name: tagName, slug: slugify(tagName) },
            },
          },
        })),
      },
    },
  })
  return post.id
}

async function collectItems(
  config: KeywordRadarConfig,
  logger: (level: 'info' | 'success' | 'error', message: string) => void
) {
  const tasks: Array<{ label: string; task: Promise<FeedItem[]> }> = []
  const activeSources = config.sources.length > 0 ? config.sources : (['google'] as RadarSourceId[])
  for (const keyword of config.keywords) {
    for (const sourceId of activeSources) {
      const srcLabel = RADAR_SOURCES.find((s) => s.id === sourceId)?.label || sourceId
      tasks.push({
        label: `${srcLabel} · ${keyword}`,
        task: fetchFeedByKeyword(keyword, sourceId),
      })
    }
  }
  for (const feedUrl of config.extraFeeds) {
    tasks.push({ label: `RSS ${feedUrl}`, task: fetchCustomFeed(feedUrl, config.keywords) })
  }
  for (const tmpl of config.customSourceTemplates) {
    for (const keyword of config.keywords) {
      const url = tmpl.urlTemplate.replace(/\{keyword\}/g, encodeURIComponent(keyword))
      tasks.push({ label: `${tmpl.name} · ${keyword}`, task: fetchCustomFeed(url, [keyword]) })
    }
  }
  logger('info', `开始抓取 ${tasks.length} 个来源`)
  const settled = await Promise.allSettled(tasks.map((item) => item.task))
  const deduped = new Map<string, FeedItem>()
  for (let index = 0; index < settled.length; index++) {
    const result = settled[index]
    const label = tasks[index]?.label || `来源 ${index + 1}`
    if (result.status !== 'fulfilled') {
      logger('error', `${label} 抓取失败：${result.reason instanceof Error ? result.reason.message : '未知错误'}`)
      continue
    }
    logger('success', `${label} 抓取完成，命中 ${result.value.length} 条`)
    for (const item of result.value) {
      if (!matchesDomainFilters(item.link, config)) continue
      const key = `${item.link}::${item.title}`
      const existing = deduped.get(key)
      if (!existing) {
        deduped.set(key, item)
        continue
      }
      deduped.set(key, {
        ...existing,
        keywords: Array.from(new Set([...existing.keywords, ...item.keywords])),
      })
    }
  }
  return Array.from(deduped.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

async function insertSeenItems(items: FeedItem[], dateKey: string) {
  const BATCH = 50
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'))").join(', ')
    const params = batch.flatMap((item) => [
      hashItem(item),
      dateKey,
      JSON.stringify(item.keywords),
      item.title,
      item.link,
      item.summary,
      item.source,
      item.publishedAt,
    ])
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO KeywordRadarSeen
       (hash, digestDate, keywords, title, link, summary, source, itemPublishedAt, postId, createdAt)
       VALUES ${placeholders}`,
      ...params
    )
  }
}

async function attachPostId(dateKey: string, postId: string) {
  await prisma.$executeRawUnsafe(`UPDATE KeywordRadarSeen SET postId = ? WHERE digestDate = ?`, postId, dateKey)
}

declare global {
  var __keywordRadarRunning: Promise<KeywordRadarRunResult> | null | undefined
}

export async function runKeywordRadar(options: { reason: 'manual' | 'scheduler' }): Promise<KeywordRadarRunResult> {
  if (globalThis.__keywordRadarRunning) return globalThis.__keywordRadarRunning

  const promise = (async () => {
    const runId = startKeywordRadarLog(options.reason)
    const log = (level: 'info' | 'success' | 'error', message: string) => {
      appendKeywordRadarLog(runId, level, message, options.reason)
    }
    await runMigrations()
    await ensureSiteConfigRow()
    const config = await getKeywordRadarConfig()
    const nowIso = new Date().toISOString()
    const dateKey = getTodayKey()
    log('info', `开始执行内容雷达（${options.reason === 'manual' ? '手动触发' : '定时触发'}）`)

    if (options.reason === 'scheduler' && !config.enabled) {
      log('info', '定时抓取未启用，跳过本次执行')
      finishKeywordRadarLog(runId)
      return { ok: true, skipped: true, message: '内容雷达未启用', matchedCount: 0, newCount: 0, digestDate: dateKey }
    }

    if (options.reason === 'scheduler' && config.lastRunAt) {
      const elapsed = Date.now() - new Date(config.lastRunAt).getTime()
      if (elapsed < config.scheduleMinutes * 60 * 1000) {
        log('info', '未到下一次执行时间，跳过本次定时抓取')
        finishKeywordRadarLog(runId)
        return {
          ok: true,
          skipped: true,
          message: '未到下一次执行时间',
          matchedCount: 0,
          newCount: 0,
          digestDate: dateKey,
        }
      }
    }

    if (config.keywords.length === 0 && config.extraFeeds.length === 0) {
      await setLastRun({ lastRunAt: nowIso, lastStatus: 'idle', lastMessage: '未配置关键词或额外 RSS 源' })
      log('error', '未配置关键词或额外 RSS 源，无法开始抓取')
      finishKeywordRadarLog(runId)
      return {
        ok: true,
        skipped: true,
        message: '未配置关键词或额外 RSS 源',
        matchedCount: 0,
        newCount: 0,
        digestDate: dateKey,
      }
    }

    try {
      log('info', `关键词 ${config.keywords.length} 个，额外 RSS ${config.extraFeeds.length} 个`)
      const matchedItems = await collectItems(config, log)
      log('info', `抓取阶段完成，共命中 ${matchedItems.length} 条候选内容`)
      const newItems = await getNewItems(matchedItems)
      log('info', `去重完成，新增 ${newItems.length} 条`)
      if (newItems.length === 0) {
        await setLastRun({ lastRunAt: nowIso, lastStatus: 'idle', lastMessage: '本次未发现新内容' })
        await pruneSeenRows(config.keepDays)
        log('info', '本次未发现新内容，已完成旧记录清理')
        finishKeywordRadarLog(runId)
        return {
          ok: true,
          message: '本次未发现新内容',
          matchedCount: matchedItems.length,
          newCount: 0,
          digestDate: dateKey,
        }
      }

      await insertSeenItems(newItems, dateKey)
      log('success', `已写入 ${newItems.length} 条去重记录`)
      log('info', config.useAi ? '开始生成 AI 日报文案' : '使用模板生成日报文案')
      const postId = await upsertDailyDigest(newItems, config, dateKey)
      await attachPostId(dateKey, postId)
      await setLastRun({
        lastRunAt: nowIso,
        lastStatus: 'success',
        lastMessage: `已整理 ${newItems.length} 条新内容`,
        lastPostId: postId,
      })
      await pruneSeenRows(config.keepDays)
      try {
        revalidateTag('posts')
      } catch {}
      log('success', `日报已生成，文章 ID：${postId}`)
      log('success', `执行完成：命中 ${matchedItems.length} 条，新增 ${newItems.length} 条`)
      finishKeywordRadarLog(runId)
      syslog
        .info('system', `内容雷达已执行：新增 ${newItems.length} 条，日报文章 ${postId}`, {
          matchedCount: matchedItems.length,
          postId,
          reason: options.reason,
        })
        .catch(() => {})
      return {
        ok: true,
        message: `已整理 ${newItems.length} 条新内容`,
        matchedCount: matchedItems.length,
        newCount: newItems.length,
        digestDate: dateKey,
        postId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await setLastRun({ lastRunAt: nowIso, lastStatus: 'failed', lastMessage: message })
      log('error', message)
      finishKeywordRadarLog(runId)
      syslog.error('system', `内容雷达执行失败：${message}`, { reason: options.reason }).catch(() => {})
      return { ok: false, message, matchedCount: 0, newCount: 0, digestDate: dateKey }
    }
  })()

  globalThis.__keywordRadarRunning = promise
  try {
    return await promise
  } finally {
    globalThis.__keywordRadarRunning = null
  }
}
