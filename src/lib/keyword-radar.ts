import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
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
  { id: 'hackernews', label: 'Hacker News', region: '国际', type: 'rss' },
  { id: 'reddit', label: 'Reddit', region: '国际', type: 'rss' },
  { id: 'devto', label: 'DEV.to', region: '国际', type: 'rss' },
  { id: 'medium', label: 'Medium', region: '国际', type: 'rss' },
  { id: 'zhihu', label: '知乎', region: '中国', type: 'html' },
  { id: 'v2ex', label: 'V2EX', region: '中国', type: 'rss' },
  { id: 'lobsters', label: 'Lobsters', region: '国际', type: 'rss' },
  { id: 'juejin', label: '掘金', region: '中国', type: 'json' },
  { id: 'csdn', label: 'CSDN', region: '中国', type: 'json' },
  { id: 'github', label: 'GitHub', region: '国际', type: 'json' },
  { id: 'wechat', label: '微信公众号', region: '中国', type: 'html' },
  { id: 'sogou', label: '搜狗资讯', region: '中国', type: 'html' },
  { id: 'duckduckgo', label: 'DuckDuckGo', region: '国际', type: 'html' },
  { id: 'yandex', label: 'Yandex News', region: '俄/国际', type: 'html' },
  { id: 'oschina', label: '开源中国', region: '中国', type: 'rss' },
  { id: '36kr', label: '36氪', region: '中国', type: 'rss' },
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
  standardMarkdown: boolean
  prompt: string
  lastRunAt: string
  lastStatus: string
  lastMessage: string
  lastPostId: string
  maxItems: number
  keepDays: number
  maxArticleAgeDays: number
  sources: RadarSourceId[]
  customSourceTemplates: Array<{ name: string; urlTemplate: string }>
  webhookUrl: string
  webhookEnabled: boolean
  useShortLinks: boolean
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

export type KeywordRadarPreviewResult = {
  ok: boolean
  message: string
  matchedCount: number
  newCount: number
  digestDate: string
  content: string
}

type DigestBuildResult = {
  content: string
  mode: 'ai' | 'fallback' | 'strict-fallback'
  reason?: string
}

type FeedItem = {
  title: string
  link: string
  summary: string
  /** Extended body text fetched from the article page (first ~500 chars) */
  bodyText?: string
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
  standardMarkdown: true,
  prompt: '',
  lastRunAt: '',
  lastStatus: '',
  lastMessage: '',
  lastPostId: '',
  maxItems: 12,
  keepDays: 14,
  maxArticleAgeDays: 7,
  sources: ['google'],
  customSourceTemplates: [],
  webhookUrl: '',
  webhookEnabled: false,
  useShortLinks: false,
}

const FETCH_TIMEOUT_MS = 10000
const MAX_FEED_ITEMS = 12
/** Source-specific retry counts (HTML parsers need more retries due to anti-bot) */
const SOURCE_RETRIES: Partial<Record<RadarSourceId, number>> = {
  zhihu: 2,
  sogou: 2,
  duckduckgo: 2,
  yandex: 2,
  csdn: 2,
  baidu: 2,
  wechat: 3,
  juejin: 2,
}

/** In-memory fetch cache to avoid duplicate requests within a single run */
let fetchCacheMap = new Map<string, { data: string; ts: number }>()
const FETCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedFetch(url: string): string | null {
  const entry = fetchCacheMap.get(url)
  if (entry && Date.now() - entry.ts < FETCH_CACHE_TTL) return entry.data
  return null
}

function setCachedFetch(url: string, data: string) {
  fetchCacheMap.set(url, { data, ts: Date.now() })
  // Limit cache size
  if (fetchCacheMap.size > 100) {
    const firstKey = fetchCacheMap.keys().next().value
    if (firstKey) fetchCacheMap.delete(firstKey)
  }
}

/** Clear fetch cache (call at start of each run) */
function clearFetchCache() {
  fetchCacheMap = new Map<string, { data: string; ts: number }>()
}
const MAX_SEEN_ROWS = 800
const RADAR_TIME_ZONE = 'Asia/Shanghai'

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
    .split(/[\n\r\t,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
}

/**
 * Parse Chinese relative time strings like "2小时前", "昨天", "3天前", "刚刚"
 * Returns ISO string or null if parsing fails
 */
function parseRelativeTime(text: string): string | null {
  const now = new Date()
  const cleaned = text.replace(/\s+/g, '').replace(/[\[\]]/g, '')

  const patterns: Array<[RegExp, (m: RegExpMatchArray) => Date]> = [
    [/^刚刚?$/, () => now],
    [/^(\d+)分钟前$/, (m) => new Date(now.getTime() - Number(m[1]) * 60 * 1000)],
    [/^(\d+)小时前$/, (m) => new Date(now.getTime() - Number(m[1]) * 3600 * 1000)],
    [
      /^昨天(\d+):(\d+)$/,
      (m) => {
        const d = new Date(now)
        d.setDate(d.getDate() - 1)
        d.setHours(Number(m[1]), Number(m[2]), 0, 0)
        return d
      },
    ],
    [/^(\d+)天前$/, (m) => new Date(now.getTime() - Number(m[1]) * 24 * 3600 * 1000)],
    [
      /^前天(\d+):(\d+)$/,
      (m) => {
        const d = new Date(now)
        d.setDate(d.getDate() - 2)
        d.setHours(Number(m[1]), Number(m[2]), 0, 0)
        return d
      },
    ],
  ]

  for (const [pattern, factory] of patterns) {
    const m = cleaned.match(pattern)
    if (m) {
      try {
        return factory(m).toISOString()
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Parse Chinese date strings like "2024年1月2日", "01月02日", "1-2", "2024-1-2"
 */
function parseChineseDate(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '').trim()
  const now = new Date()

  const fullDateRe = /^(\d{4})[年](\d{1,2})[月](\d{1,2})日?$/
  const m1 = cleaned.match(fullDateRe)
  if (m1) {
    try {
      const year = Number(m1[1])
      const month = Number(m1[2])
      const day = Number(m1[3])
      if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d.toISOString()
    } catch {
      return null
    }
  }

  const shortDateRe = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  const m2 = cleaned.match(shortDateRe)
  if (m2) {
    try {
      const year = Number(m2[1])
      const month = Number(m2[2])
      const day = Number(m2[3])
      if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d.toISOString()
    } catch {
      return null
    }
  }

  const monthDayRe = /^(\d{1,2})[月](\d{1,2})日?$/
  const m3 = cleaned.match(monthDayRe)
  if (m3) {
    try {
      const month = Number(m3[1])
      const day = Number(m3[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) return null
      const d = new Date(now.getFullYear(), month - 1, day)
      if (!isNaN(d.getTime())) return d.toISOString()
    } catch {
      return null
    }
  }

  const dashRe = /^(\d{1,2})-(\d{1,2})$/
  const m4 = cleaned.match(dashRe)
  if (m4) {
    try {
      const month = Number(m4[1])
      const day = Number(m4[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) return null
      let year = now.getFullYear()
      const thisMonth = now.getMonth() + 1
      const todayDay = now.getDate()
      if (month < thisMonth || (month === thisMonth && day < todayDay)) year++
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d.toISOString()
    } catch {
      return null
    }
  }

  return null
}

/**
 * Extract publication date from text using relative and Chinese date parsing
 */
function extractDateFromText(text: string): string | null {
  if (!text) return null
  const rel = parseRelativeTime(text)
  if (rel) return rel
  const chinese = parseChineseDate(text)
  if (chinese) return chinese
  return null
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
    standardMarkdown:
      row.keywordRadarStandardMarkdown === undefined
        ? DEFAULT_CONFIG.standardMarkdown
        : Boolean(Number(row.keywordRadarStandardMarkdown) || 0),
    prompt: String(row.keywordRadarPrompt || ''),
    lastRunAt: String(row.keywordRadarLastRunAt || ''),
    lastStatus: String(row.keywordRadarLastStatus || ''),
    lastMessage: String(row.keywordRadarLastMessage || ''),
    lastPostId: String(row.keywordRadarLastPostId || ''),
    maxItems: Math.max(3, Math.min(30, Number(row.keywordRadarMaxItems) || DEFAULT_CONFIG.maxItems)),
    keepDays: Math.max(1, Math.min(90, Number(row.keywordRadarKeepDays) || DEFAULT_CONFIG.keepDays)),
    maxArticleAgeDays: Math.max(
      1,
      Math.min(30, Number(row.keywordRadarMaxArticleAgeDays) || DEFAULT_CONFIG.maxArticleAgeDays)
    ),
    sources: ((arr) => (arr.length ? arr : DEFAULT_CONFIG.sources))(
      (parseArray(row.keywordRadarSources) as RadarSourceId[]).filter((s) => RADAR_SOURCES.some((def) => def.id === s))
    ),
    customSourceTemplates: parseCustomSourceTemplates(row.keywordRadarCustomSourceTemplates),
    webhookUrl: String(row.keywordRadarWebhookUrl || ''),
    webhookEnabled: Boolean(Number(row.keywordRadarWebhookEnabled) || 0),
    useShortLinks:
      row.keywordRadarUseShortLinks === undefined
        ? DEFAULT_CONFIG.useShortLinks
        : Boolean(Number(row.keywordRadarUseShortLinks) || 0),
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

function buildHackerNewsFeedUrl(keyword: string) {
  return `https://hnrss.org/newest?q=${encodeURIComponent(keyword)}&count=20`
}

function buildRedditFeedUrl(keyword: string) {
  return `https://www.reddit.com/search.rss?q=${encodeURIComponent(keyword)}&sort=new&t=week`
}

function buildDevtoFeedUrl(keyword: string) {
  return `https://dev.to/search/feed_content?per_page=15&search_fields=${encodeURIComponent(keyword)}&class_name=Article`
}

function buildMediumFeedUrl(keyword: string) {
  return `https://medium.com/feed/tag/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'))}`
}

function buildZhihuSearchUrl(keyword: string) {
  return `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(keyword)}`
}

function buildV2exFeedUrl(_keyword: string) {
  return `https://www.v2ex.com/feed/tab/tech.xml`
}

function buildLobstersFeedUrl(keyword: string) {
  return `https://lobste.rs/search.rss?q=${encodeURIComponent(keyword)}&what=stories&order=newest`
}

function buildOschinaFeedUrl(keyword: string) {
  return `https://www.oschina.net/news/rss?content=news&q=${encodeURIComponent(keyword)}`
}

function build36krFeedUrl(keyword: string) {
  return `https://36kr.com/feed/${encodeURIComponent(keyword)}`
}

function buildJuejinSearchUrl(_keyword: string) {
  return `https://api.juejin.cn/search_api/v1/search`
}

function buildCsdnSearchUrl(keyword: string) {
  return `https://so.csdn.net/api/v3/search?q=${encodeURIComponent(keyword)}&t=blog&p=1&s=new&tm=0`
}

function buildGithubSearchUrl(keyword: string) {
  return `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=updated&order=desc&per_page=15`
}

function buildBaiduNewsHtmlUrl(keyword: string) {
  return `https://www.baidu.com/s?tn=news&rtt=4&bsst=1&cl=2&wd=${encodeURIComponent(keyword)}`
}

function buildWechatSearchUrl(keyword: string) {
  return `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword)}&ie=utf8&s_from=input&_sug_=n&_sug_type_=`
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/** Strip HTML tags and normalize whitespace */
function stripHtml(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Deduplicate items by link hostname+pathname */
function dedupeByLink(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    try {
      const u = new URL(item.link)
      const key = `${u.hostname}${u.pathname}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    } catch {
      return true
    }
  })
}

/** Compute bigram array for a string (for similarity comparison) */
function bigrams(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7a3]+/g, '')
  const arr: string[] = []
  for (let i = 0; i < normalized.length - 1; i++) {
    arr.push(normalized.slice(i, i + 2))
  }
  return arr
}

/** Dice coefficient similarity between two strings (0-1) */
function titleSimilarity(a: string, b: string): number {
  // Quick length-ratio check — very different lengths are unlikely similar
  const lenRatio = a.length > b.length ? a.length / b.length : b.length / a.length
  if (lenRatio > 3) return 0
  const ba = bigrams(a)
  const bb = bigrams(b)
  if (ba.length === 0 || bb.length === 0) return 0
  const bbSet = new Set(bb)
  let intersection = 0
  ba.forEach((bg) => {
    if (bbSet.has(bg)) intersection++
  })
  return (2 * intersection) / (ba.length + bb.length)
}

/** Deduplicate by title similarity — merge keywords from near-duplicate items */
function dedupeBySimilarTitle(items: FeedItem[], threshold = 0.7): FeedItem[] {
  const result: FeedItem[] = []
  for (const item of items) {
    const dup = result.find((existing) => titleSimilarity(existing.title, item.title) >= threshold)
    if (dup) {
      // Merge keywords from the duplicate
      dup.keywords = Array.from(new Set([...dup.keywords, ...item.keywords]))
      // Prefer the item with longer summary
      if (item.summary.length > dup.summary.length) {
        dup.summary = item.summary
      }
      // Mark source as multi-source
      if (!dup.source.includes(item.source) && item.source !== dup.source) {
        dup.source = `${dup.source} / ${item.source}`
      }
    } else {
      result.push({ ...item })
    }
  }
  return result
}

/**
 * Parse news results from Sogou HTML search page.
 */
function parseSogouHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Strategy 1: vrTitle class (desktop layout)
  const blockRe = /<h3[^>]*class="[^"]*vr[Tt]itle[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const h3 = m[1]
    const linkMatch = h3.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue
    const link = linkMatch[1]
    const title = stripHtml(linkMatch[2])
    if (!title || title.length < 4 || !link) continue
    const afterH3 = html.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 800)
    const descMatch =
      afterH3.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
      afterH3.match(/<div[^>]*class="[^"]*rb[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const summary = descMatch ? stripHtml(descMatch[1] || descMatch[2] || '') : ''
    const dateMatch = afterH3.match(/<(?:span|div)[^>]*class="[^"]*(?:s2|time)[^"]*"[^>]*>([^<]+)<\/span>/i)
    const publishedAt = dateMatch
      ? extractDateFromText(dateMatch[1]) || new Date().toISOString()
      : new Date().toISOString()
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt,
      source: '搜狗资讯',
      keywords: [keyword],
    })
  }
  // Strategy 2: news-result class (mobile/alt layout)
  if (items.length === 0) {
    const altRe =
      /<div[^>]*class="[^"]*news[_-]?result[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*news[_-]?result|$)/gi
    while ((m = altRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const block = m[1]
      const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      if (!linkMatch) continue
      const title = stripHtml(linkMatch[2])
      if (!title || title.length < 4) continue
      const dateMatch = block.match(/<(?:span|div)[^>]*class="[^"]*(?:s2|time)[^"]*"[^>]*>([^<]+)<\/span>/i)
      const publishedAt = dateMatch
        ? extractDateFromText(dateMatch[1]) || new Date().toISOString()
        : new Date().toISOString()
      items.push({
        title,
        link: linkMatch[1],
        summary: '',
        publishedAt,
        source: '搜狗资讯',
        keywords: [keyword],
      })
    }
  }
  // Strategy 3: broad fallback — external links only
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const title = stripHtml(m[2])
      if (!title || title.length < 6) continue
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
  return dedupeByLink(items)
}

/**
 * Parse news results from DuckDuckGo HTML lite page.
 */
function parseDuckDuckGoHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Strategy 1: result__a class (HTML lite)
  const resultRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = resultRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    let link = m[1]
    const title = stripHtml(m[2])
    if (!title || !link) continue
    const uddg = link.match(/uddg=([^&]+)/)
    if (uddg) {
      try {
        link = decodeURIComponent(uddg[1])
      } catch {
        /* keep */
      }
    }
    if (!link.startsWith('http')) continue
    const afterLink = html.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 600)
    const snippetMatch =
      afterLink.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      afterLink.match(/<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const summary = snippetMatch ? stripHtml(snippetMatch[1]) : ''
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt: new Date().toISOString(),
      source: 'DuckDuckGo',
      keywords: [keyword],
    })
  }
  // Strategy 2: web-result with data- attributes
  if (items.length === 0) {
    const altRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*data-[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = altRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const title = stripHtml(m[2])
      if (!title || title.length < 6 || m[1].includes('duckduckgo.com')) continue
      items.push({
        title,
        link: m[1],
        summary: '',
        publishedAt: new Date().toISOString(),
        source: 'DuckDuckGo',
        keywords: [keyword],
      })
    }
  }
  // Strategy 3: broad fallback
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const title = stripHtml(m[2])
      if (!title || title.length < 6) continue
      items.push({
        title,
        link: m[1],
        summary: '',
        publishedAt: new Date().toISOString(),
        source: 'DuckDuckGo',
        keywords: [keyword],
      })
    }
  }
  return dedupeByLink(items)
}

/**
 * Parse news results from Yandex News search page.
 */
function parseYandexHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Strategy 1: mg-snippet or news-snippet classes
  const snippetRe = /<a[^>]+class="[^"]*(?:mg-snippet|news-snippet)[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = snippetRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const link = m[1]
    const title = stripHtml(m[2])
    if (!title || title.length < 4 || !link.startsWith('http')) continue
    items.push({
      title,
      link,
      summary: '',
      publishedAt: new Date().toISOString(),
      source: 'Yandex News',
      keywords: [keyword],
    })
  }
  // Strategy 2: snippet class with title child
  if (items.length === 0) {
    const re = /<a[^>]+class="[^"]*snippet[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = re.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const block = m[2]
      const titleMatch = block.match(/<[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)
      const title = titleMatch ? stripHtml(titleMatch[1]) : stripHtml(block)
      if (!title || title.length < 4 || !link.startsWith('http')) continue
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
  // Strategy 3: data-url attribute (SPA-rendered snippets)
  if (items.length === 0) {
    const dataRe = /data-url="(https?:\/\/(?!yandex\.)[^"]+)"/gi
    while ((m = dataRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const link = m[1]
      const after = html.slice(m.index, m.index + 500)
      const titleMatch = after.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i)
      const title = titleMatch ? stripHtml(titleMatch[1]) : ''
      if (!title || title.length < 4) continue
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
  // Strategy 4: broad external links fallback
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/(?!yandex\.|ya\.)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const title = stripHtml(m[2])
      if (!title || title.length < 6) continue
      items.push({
        title,
        link: m[1],
        summary: '',
        publishedAt: new Date().toISOString(),
        source: 'Yandex News',
        keywords: [keyword],
      })
    }
  }
  return dedupeByLink(items)
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
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RADAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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

function formatRadarLink(url: string, label = '查看原文') {
  return `[${label}](${url})`
}

function escapeForPrompt(text: string | undefined | null): string {
  if (!text) return ''
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

// ---------- Short link helpers ----------

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function toBase62(num: number, length: number): string {
  let result = ''
  let n = Math.abs(num)
  while (result.length < length) {
    result = BASE62[n % 62] + result
    n = Math.floor(n / 62)
  }
  return result
}

function generateShortCode(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest()
  const num = hash.readUInt32BE(0)
  return toBase62(num, 6)
}

async function shortenLink(url: string): Promise<string> {
  let code = generateShortCode(url)
  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const inserted = await prisma.$executeRawUnsafe(
      "INSERT OR IGNORE INTO ShortLink (code, url, clicks, createdAt) VALUES (?, ?, 0, datetime('now'))",
      code,
      url
    )
    if (inserted === 1) break

    const existing = await prisma.$queryRawUnsafe<{ code: string; url: string }[]>(
      'SELECT code, url FROM ShortLink WHERE code = ?',
      code
    )
    if (existing.length > 0 && existing[0].url === url) {
      break
    }
    if (attempt < maxAttempts - 1) {
      const hash2 = crypto
        .createHash('md5')
        .update(url + ':' + Date.now() + ':' + Math.random())
        .digest()
      code = toBase62(hash2.readUInt32BE(0), 6)
    }
  }
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  return baseUrl + '/go/' + code
}

async function shortenItemLinks(items: FeedItem[], config: KeywordRadarConfig): Promise<FeedItem[]> {
  if (!config.useShortLinks) return items
  const result: FeedItem[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      const shortUrl = await shortenLink(item.link)
      result.push(Object.assign({}, item, { link: shortUrl }))
    } catch (_e) {
      // On error keep original link
      result.push(item)
    }
  }
  return result
}

function formatPublishedAtLabel(value: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '未知'
}

function normalizeRadarMarkdown(content: string, config: KeywordRadarConfig, dateKey: string) {
  const marker = makeDigestMarker(dateKey)
  let normalized = String(content || '')
    .replace(/\r\n?/g, '\n')
    .trim()

  const fenced = normalized.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i)
  if (fenced) normalized = fenced[1].trim()

  normalized = normalized
    .replace(/^#{1,6}([^#\s])/gm, (_m) => _m.replace(/^(#{1,6})(.*)$/m, '$1 $2'))
    .replace(/^-\s*原文：\s*(https?:\/\/\S+)$/gm, (_m, url: string) => `- 原文：${formatRadarLink(url)}`)
    .replace(/^原文：\s*(https?:\/\/\S+)$/gm, (_m, url: string) => `原文：${formatRadarLink(url)}`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized.includes(marker)) {
    normalized = `${marker}\n\n${normalized}`
  } else if (!normalized.startsWith(marker)) {
    normalized = `${marker}\n\n${normalized.replace(marker, '').trim()}`
  }

  const body = normalized.replace(marker, '').trimStart()
  if (!/^#\s+/m.test(body)) {
    normalized = `${marker}\n\n# ${formatDateLabel(dateKey)} 关键词资讯日报\n\n${body}`.trim()
  }

  if (config.standardMarkdown) {
    normalized = normalized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } else {
    normalized = normalized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<(?!!--)[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return normalized
}

function strictFallbackDigestMarkdown(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const marker = makeDigestMarker(dateKey)
  const keywordLine = config.keywords.length ? config.keywords.join('、') : '未设置关键词'
  const highlights = items.slice(0, Math.min(3, config.maxItems)).map((item) => {
    const summary = item.summary ? item.summary.slice(0, 80) : '暂无摘要'
    return `- **${item.title}**：${summary} ${formatRadarLink(item.link, '→ 原文')}`
  })
  const sections = items.slice(0, config.maxItems).map((item, index) => {
    const summaryText = item.summary
      ? item.summary.length > 140
        ? `${item.summary.slice(0, 140)}…`
        : item.summary
      : '该内容暂无详细摘要，建议点击原文了解详情。'
    const sourceNote = /dev\.to|medium|blog|博客/i.test(item.source)
      ? `来自博客 ${item.source}`
      : item.source || '未知来源'
    return [
      `### ${index + 1}. ${item.title}`,
      '',
      summaryText,
      '',
      `- 来源：${sourceNote}`,
      `- 关键词：${item.keywords.join(' / ') || '未匹配'}`,
      `- 时间：${formatPublishedAtLabel(item.publishedAt)}`,
      `- ${formatRadarLink(item.link, '阅读原文')}`,
    ].join('\n')
  })

  return normalizeRadarMarkdown(
    [
      marker,
      `# ${formatDateLabel(dateKey)} 关键词资讯日报`,
      '',
      `> 本期日报围绕 **${keywordLine}** 自动聚合，覆盖新闻与博客，共整理 ${items.length} 条内容。`,
      '',
      '## 今日亮点',
      '',
      ...(highlights.length > 0 ? highlights : ['- 暂无可展示内容']),
      '',
      '## 逐条速读',
      '',
      ...sections,
      '',
      '---',
      '',
      `*以上内容由内容雷达自动聚合生成（严格模板），信息仅供参考。*`,
    ].join('\n'),
    config,
    dateKey
  )
}

function inspectAiDigestQuality(content: string, config: KeywordRadarConfig) {
  const body = content.replace(/<!--\s*keyword-radar:[^>]+-->/, '').trim()
  const markdownHeadingCount = (body.match(/^#{1,3}\s+/gm) || []).length
  const markdownLinkCount = (body.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g) || []).length
  const bareUrlCount = (body.match(/(^|[^\]\(])(https?:\/\/\S+)/g) || []).length
  const htmlTagCount = (body.match(/<(?!!--)[^>]+>/g) || []).length
  const longLineCount = body.split('\n').filter((line) => line.length > 220 && /https?:\/\//.test(line)).length

  if (markdownHeadingCount < 2) return { ok: false, reason: '标题层级不足' }
  if (config.standardMarkdown && markdownLinkCount === 0) return { ok: false, reason: '缺少 Markdown 链接' }
  if (config.standardMarkdown && bareUrlCount > Math.max(0, markdownLinkCount - 2))
    return { ok: false, reason: '裸链接过多' }
  if (config.standardMarkdown && htmlTagCount > 0) return { ok: false, reason: '包含 HTML 标签' }
  if (longLineCount > 0) return { ok: false, reason: '存在超长链接行' }
  // Check minimum content length (excluding marker and headings)
  const plainBody = body
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
  if (plainBody.length < 200) return { ok: false, reason: '内容过短，可能生成不完整' }
  // Check for repetitive content (same sentence repeated)
  const sentences = plainBody.split(/[。！？\n]+/).filter((s) => s.trim().length > 10)
  if (sentences.length >= 4) {
    const uniqueSentences = new Map<string, boolean>()
    let dupeCount = 0
    for (const s of sentences) {
      const key = s.trim().slice(0, 40)
      if (uniqueSentences.has(key)) dupeCount++
      else uniqueSentences.set(key, true)
    }
    if (dupeCount > sentences.length * 0.3) return { ok: false, reason: 'AI 输出内容重复度过高' }
  }
  return { ok: true }
}

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
]

/** Source-specific headers for anti-scraping (Chinese sources need matching Referer/Accept) */
function getSourceHeaders(url: string): Record<string, string> {
  const base: Record<string, string> = {
    'User-Agent': randomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  }
  if (url.includes('zhihu.com')) {
    base.Referer = 'https://www.zhihu.com/'
  } else if (url.includes('sogou.com')) {
    base.Referer = 'https://www.sogou.com/'
  } else if (url.includes('weixin.sogou.com')) {
    base.Referer = 'https://weixin.sogou.com/'
  } else if (url.includes('baidu.com')) {
    base.Referer = 'https://www.baidu.com/'
  } else if (url.includes('csdn.net')) {
    base.Referer = 'https://so.csdn.net/'
  } else {
    base.Referer = 'https://www.google.com/'
  }
  return base
}

function randomUserAgent() {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)]
}

/** Random delay between min and max ms */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise((r) => setTimeout(r, ms))
}

/** Simple concurrency limiter */
function createLimiter(concurrency: number) {
  let running = 0
  const queue: Array<() => void> = []
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        running++
        fn()
          .then(resolve, reject)
          .finally(() => {
            running--
            const next = queue.shift()
            if (next) next()
          })
      }
      if (running < concurrency) run()
      else queue.push(run)
    })
}

async function fetchXml(url: string, retries = 1): Promise<string> {
  // Check in-memory cache first
  const cached = getCachedFetch(url)
  if (cached) return cached

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Random pre-request jitter — longer for Chinese sources to avoid anti-bot
    const isCnSource = url.includes('zhihu.com') || url.includes('sogou.com') || url.includes('baidu.com')
    if (attempt === 0) await randomDelay(isCnSource ? 500 : 300, isCnSource ? 1800 : 1200)
    // Adaptive timeout: increase on retry
    const timeout = FETCH_TIMEOUT_MS + attempt * 5000
    try {
      const res = await fetch(url, {
        headers: getSourceHeaders(url),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeout),
      })
      if (res.status === 429) {
        // Rate limited — wait longer before retry
        if (attempt < retries) await randomDelay(3000 + attempt * 3000, 6000 + attempt * 4000)
        throw new Error(`请求被限流 429`)
      }
      if (res.status >= 500 && attempt < retries) {
        // Server error — retry with backoff
        await randomDelay(2000 + attempt * 2000, 4000 + attempt * 3000)
        throw new Error(`服务器错误 ${res.status}`)
      }
      if (!res.ok) throw new Error(`抓取失败 ${res.status}`)
      const text = await res.text()
      setCachedFetch(url, text)
      return text
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Exponential backoff with jitter on retry
      if (attempt < retries) await randomDelay(1500 + attempt * 1500, 3000 + attempt * 2500)
    }
  }
  throw lastError!
}

/**
 * Parse search results from Zhihu search page.
 */
function parseZhihuHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []

  // Strategy 0: Try to extract from initialData JSON blob (SSR data)
  const jsonMatch = html.match(/<script\s+id="js-initialData"[^>]*>([\s\S]*?)<\/script>/i)
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1])
      const entities = data?.initialState?.search?.items || data?.initialState?.entities?.searchResults || {}
      const keys = Object.keys(entities)
      keys.forEach(function (key) {
        if (items.length >= MAX_FEED_ITEMS) return
        const item = entities[key]
        const obj = item?.object || item
        if (!obj) return
        const title = obj.title || obj.name || ''
        const url = obj.url || ''
        if (!title || title.length < 4 || !url) return
        const excerpt = obj.excerpt || obj.content || ''
        items.push({
          title: stripHtml(title),
          link: url.startsWith('http') ? url : 'https://www.zhihu.com' + url,
          summary: toSummary(stripHtml(excerpt), 200),
          publishedAt: obj.created_time ? new Date(obj.created_time * 1000).toISOString() : new Date().toISOString(),
          source: '知乎',
          keywords: [keyword],
        })
      })
      if (items.length > 0) return dedupeByLink(items)
    } catch {
      /* json parse failed, try HTML strategies */
    }
  }

  // Strategy 1: Search result cards with data attributes
  const cardRe =
    /<div[^>]*class="[^"]*SearchResult-Card[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*SearchResult-Card|$)/gi
  let m: RegExpExecArray | null
  while ((m = cardRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = m[1]
    const titleMatch = block.match(
      /<a[^>]+href="([^"]*(?:zhihu\.com\/(?:question|p)[^"]*|zhuanlan[^"]*)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i
    )
    if (!titleMatch) continue
    const link = titleMatch[1].startsWith('http') ? titleMatch[1] : `https://www.zhihu.com${titleMatch[1]}`
    const title = stripHtml(titleMatch[2])
    if (!title || title.length < 4) continue
    const descMatch =
      block.match(/<span[^>]*class="[^"]*RichText[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const summary = descMatch ? stripHtml(descMatch[1]).slice(0, 200) : ''
    const dateMatch =
      block.match(/(?:发布于|创建于|updated?)[：:\s]*([^<"<]+)/i) || block.match(/data-date[="'][^"']*["']/i)
    let publishedAt = new Date().toISOString()
    if (dateMatch) {
      const dateStr = dateMatch[1] || dateMatch[0]
      const extracted = extractDateFromText(dateStr)
      if (extracted) publishedAt = extracted
    }
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt,
      source: '知乎',
      keywords: [keyword],
    })
  }
  // Strategy 2: Broad link fallback for zhihu question/article pages
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/(?:www\.)?zhihu\.com\/(?:question\/\d+|p\/\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const title = stripHtml(m[2])
      if (!title || title.length < 6) continue
      items.push({
        title,
        link: m[1],
        summary: '',
        publishedAt: new Date().toISOString(),
        source: '知乎',
        keywords: [keyword],
      })
    }
  }
  return dedupeByLink(items)
}

async function fetchDevtoArticles(keyword: string): Promise<FeedItem[]> {
  const url = buildDevtoFeedUrl(keyword)
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt === 0) await randomDelay(200, 800)
      const res = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS + attempt * 4000),
      })
      if (!res.ok) {
        if (attempt < 1 && res.status >= 500) {
          await randomDelay(1500, 3000)
          continue
        }
        return []
      }
      const data = (await res.json()) as {
        result?: Array<{
          title?: string
          path?: string
          user?: { name?: string }
          tag_list?: string[]
          published_at_int?: number
          body_text?: string
        }>
      }
      const articles = data.result || (Array.isArray(data) ? data : [])
      return (
        articles as Array<{
          title?: string
          path?: string
          user?: { name?: string }
          tag_list?: string[]
          published_at_int?: number
          body_text?: string
        }>
      )
        .slice(0, MAX_FEED_ITEMS)
        .filter((a) => a.title && a.path)
        .map((a) => ({
          title: String(a.title || ''),
          link: a.path?.startsWith('http') ? a.path : `https://dev.to${a.path}`,
          summary: toSummary(a.body_text || '', 200),
          publishedAt: a.published_at_int
            ? new Date(a.published_at_int * 1000).toISOString()
            : new Date().toISOString(),
          source: a.user?.name ? `DEV.to / ${a.user.name}` : 'DEV.to',
          keywords: [keyword],
        }))
    } catch {
      if (attempt < 1) continue
      return []
    }
  }
  return []
}

/** Fetch articles from Juejin (掘金) — two-step: tag lookup + tag feed with keyword filter */
async function fetchJuejinArticles(keyword: string): Promise<FeedItem[]> {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': randomUserAgent(),
    Referer: 'https://juejin.cn/',
  }
  // Step 1: Try search API first (may return empty if restricted)
  try {
    await randomDelay(200, 800)
    const searchRes = await fetch(buildJuejinSearchUrl(keyword), {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyword, search_type: 2, cursor: '0', limit: 20, sort_type: 0 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        data?: Array<{
          result_model?: {
            article_info?: { article_id?: string; title?: string; brief_content?: string; ctime?: string }
            author_info?: { user_name?: string }
          }
        }>
      }
      const searchArticles = searchData.data || []
      if (searchArticles.length > 0) {
        return searchArticles
          .slice(0, MAX_FEED_ITEMS)
          .filter((a) => a.result_model?.article_info?.title && a.result_model?.article_info?.article_id)
          .map((a) => {
            const info = a.result_model!.article_info!
            const author = a.result_model?.author_info?.user_name
            return {
              title: stripHtml(info.title || ''),
              link: `https://juejin.cn/post/${info.article_id}`,
              summary: toSummary(info.brief_content || '', 200),
              publishedAt: info.ctime ? new Date(Number(info.ctime) * 1000).toISOString() : new Date().toISOString(),
              source: author ? `掘金 / ${author}` : '掘金',
              keywords: [keyword],
            }
          })
      }
    }
  } catch {
    /* search failed, try tag fallback */
  }

  // Step 2: Fallback — find matching tag, then fetch tag feed with keyword filtering
  try {
    await randomDelay(300, 800)
    const tagRes = await fetch('https://api.juejin.cn/tag_api/v1/query_tag_list', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key_word: keyword, type: 0 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!tagRes.ok) return []
    const tagData = (await tagRes.json()) as {
      data?: Array<{ tag_id?: string; tag?: { tag_name?: string } }>
    }
    const tags = tagData.data || []
    if (tags.length === 0) return []

    // Use the first matching tag
    const tagId = tags[0].tag_id
    if (!tagId) return []

    await randomDelay(300, 800)
    const feedRes = await fetch('https://api.juejin.cn/recommend_api/v1/article/recommend_tag_feed', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id_type: 2, sort_type: 200, cursor: '0', limit: 20, tag_ids: [tagId] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!feedRes.ok) return []
    const feedData = (await feedRes.json()) as {
      data?: Array<{
        article_info?: { article_id?: string; title?: string; brief_content?: string; ctime?: string }
        author_user_info?: { user_name?: string }
      }>
    }
    const articles = feedData.data || []
    const kw = normalizeKeyword(keyword)
    return articles
      .filter((a) => {
        if (!a.article_info?.title || !a.article_info?.article_id) return false
        const haystack = normalizeKeyword(`${a.article_info.title} ${a.article_info.brief_content || ''}`)
        return haystack.includes(kw)
      })
      .slice(0, MAX_FEED_ITEMS)
      .map((a) => {
        const info = a.article_info!
        const author = a.author_user_info?.user_name
        return {
          title: stripHtml(info.title || ''),
          link: `https://juejin.cn/post/${info.article_id}`,
          summary: toSummary(info.brief_content || '', 200),
          publishedAt: info.ctime ? new Date(Number(info.ctime) * 1000).toISOString() : new Date().toISOString(),
          source: author ? `掘金 / ${author}` : '掘金',
          keywords: [keyword],
        }
      })
  } catch {
    return []
  }
}

/** Fetch articles from CSDN search API */
async function fetchCsdnArticles(keyword: string): Promise<FeedItem[]> {
  const url = buildCsdnSearchUrl(keyword)
  const retries = SOURCE_RETRIES.csdn || 1
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt === 0) await randomDelay(300, 1000)
      const res = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://so.csdn.net/',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS + attempt * 4000),
      })
      if (!res.ok) {
        if (attempt < retries && (res.status >= 500 || res.status === 429)) {
          await randomDelay(2000 + attempt * 2000, 4000 + attempt * 3000)
          continue
        }
        return []
      }
      const data = (await res.json()) as {
        result_vos?: Array<{
          title?: string
          url?: string
          description?: string
          create_time_str?: string
          nickname?: string
        }>
      }
      const articles = data.result_vos || []
      return articles
        .slice(0, MAX_FEED_ITEMS)
        .filter((a) => a.title && a.url)
        .map((a) => ({
          title: stripHtml(a.title || ''),
          link: a.url!,
          summary: toSummary(a.description || '', 200),
          publishedAt: a.create_time_str ? new Date(a.create_time_str).toISOString() : new Date().toISOString(),
          source: a.nickname ? `CSDN / ${a.nickname}` : 'CSDN',
          keywords: [keyword],
        }))
    } catch {
      if (attempt < retries) continue
      return []
    }
  }
  return []
}

/** Fetch repos from GitHub search API */
async function fetchGithubRepos(keyword: string): Promise<FeedItem[]> {
  const url = buildGithubSearchUrl(keyword)
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt === 0) await randomDelay(200, 600)
      const res = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS + attempt * 4000),
      })
      if (!res.ok) {
        if (attempt < 1 && (res.status >= 500 || res.status === 403)) {
          await randomDelay(2000, 5000)
          continue
        }
        return []
      }
      const data = (await res.json()) as {
        items?: Array<{
          full_name?: string
          html_url?: string
          description?: string
          updated_at?: string
          stargazers_count?: number
          language?: string
          owner?: { login?: string }
        }>
      }
      const repos = data.items || []
      return repos
        .slice(0, MAX_FEED_ITEMS)
        .filter((r) => r.full_name && r.html_url)
        .map((r) => {
          const stars = r.stargazers_count ? ` ⭐${r.stargazers_count}` : ''
          const lang = r.language ? ` [${r.language}]` : ''
          return {
            title: `${r.full_name}${lang}${stars}`,
            link: r.html_url!,
            summary: toSummary(r.description || '', 200),
            publishedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
            source: r.owner?.login ? `GitHub / ${r.owner.login}` : 'GitHub',
            keywords: [keyword],
          }
        })
    } catch {
      if (attempt < 1) continue
      return []
    }
  }
  return []
}

/** Parse WeChat articles from Sogou WeChat search page */
function parseWechatHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Strategy 1: txt-box blocks with h3 > a title (standard layout)
  const boxRe = /<div\s+class="txt-box">([\s\S]*?)(?=<\/li>|<div\s+class="txt-box">)/gi
  let m: RegExpExecArray | null
  while ((m = boxRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = m[1]
    const titleMatch = block.match(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i)
    if (!titleMatch) continue
    let link = titleMatch[1].replace(/&amp;/g, '&')
    // Sogou uses redirect links — prefix with domain if relative
    if (link.startsWith('/link?')) link = `https://weixin.sogou.com${link}`
    const title = stripHtml(titleMatch[2].replace(/<!--[\s\S]*?-->/g, ''))
    if (!title || title.length < 4) continue
    const summaryMatch = block.match(/<p[^>]*class="[^"]*txt-info[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    const summary = summaryMatch ? stripHtml(summaryMatch[1].replace(/<!--[\s\S]*?-->/g, '')) : ''
    const accountMatch = block.match(/<span[^>]*class="[^"]*all-time-y2[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const account = accountMatch ? stripHtml(accountMatch[1]) : ''
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt: new Date().toISOString(),
      source: account ? `微信 / ${account}` : '微信公众号',
      keywords: [keyword],
    })
  }
  // Strategy 2: sogou_vr li items (broader match)
  if (items.length === 0) {
    const liRe = /<li[^>]*id="sogou_vr_[^"]*"[^>]*>([\s\S]*?)(?=<\/li>)/gi
    while ((m = liRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const block = m[1]
      const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*uigs="article_title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      if (!linkMatch) continue
      let link = linkMatch[1].replace(/&amp;/g, '&')
      if (link.startsWith('/link?')) link = `https://weixin.sogou.com${link}`
      const title = stripHtml(linkMatch[2].replace(/<!--[\s\S]*?-->/g, ''))
      if (!title || title.length < 4) continue
      items.push({
        title,
        link,
        summary: '',
        publishedAt: new Date().toISOString(),
        source: '微信公众号',
        keywords: [keyword],
      })
    }
  }
  return dedupeByLink(items)
}

/** Parse news results from Baidu HTML search page (fallback when RSS fails) */
function parseBaiduNewsHtml(html: string, keyword: string): FeedItem[] {
  const items: FeedItem[] = []
  // Strategy 1: result class with h3 title
  const blockRe = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*result[^"]*"|$)/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
    const block = m[1]
    const titleMatch = block.match(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i)
    if (!titleMatch) continue
    const link = titleMatch[1]
    const title = stripHtml(titleMatch[2])
    if (!title || title.length < 4 || !link) continue
    const descMatch =
      block.match(/<div[^>]*class="[^"]*c-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const summary = descMatch ? stripHtml(descMatch[1]) : ''
    const grayMatch = block.match(/<span[^>]*class="[^"]*c-color-gray[^"]*"[^>]*>([^<]+)<\/span>/i)
    const sourceLabel = grayMatch ? stripHtml(grayMatch[1]) : '百度资讯'
    const publishedAt = grayMatch
      ? extractDateFromText(grayMatch[1]) || new Date().toISOString()
      : new Date().toISOString()
    items.push({
      title,
      link,
      summary: toSummary(summary),
      publishedAt,
      source: sourceLabel || '百度资讯',
      keywords: [keyword],
    })
  }
  // Strategy 2: broad link fallback
  if (items.length === 0) {
    const fbRe = /<a[^>]+href="(https?:\/\/(?!www\.baidu\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = fbRe.exec(html)) !== null && items.length < MAX_FEED_ITEMS) {
      const title = stripHtml(m[2])
      if (!title || title.length < 8) continue
      items.push({
        title,
        link: m[1],
        summary: '',
        publishedAt: new Date().toISOString(),
        source: '百度资讯',
        keywords: [keyword],
      })
    }
  }
  return dedupeByLink(items)
}

async function fetchFeedByKeyword(keyword: string, sourceId: RadarSourceId = 'google'): Promise<FeedItem[]> {
  const rssUrlMap: Partial<Record<RadarSourceId, string>> = {
    google: buildGoogleNewsFeedUrl(keyword),
    bing: buildBingNewsFeedUrl(keyword),
    baidu: buildBaiduNewsFeedUrl(keyword),
    yahoo: buildYahooNewsFeedUrl(keyword),
    hackernews: buildHackerNewsFeedUrl(keyword),
    reddit: buildRedditFeedUrl(keyword),
    medium: buildMediumFeedUrl(keyword),
    v2ex: buildV2exFeedUrl(keyword),
    lobsters: buildLobstersFeedUrl(keyword),
    oschina: buildOschinaFeedUrl(keyword),
    '36kr': build36krFeedUrl(keyword),
  }
  const htmlUrlMap: Partial<Record<RadarSourceId, string>> = {
    sogou: buildSogouNewsUrl(keyword),
    duckduckgo: buildDuckDuckGoNewsUrl(keyword),
    yandex: buildYandexNewsUrl(keyword),
    zhihu: buildZhihuSearchUrl(keyword),
    wechat: buildWechatSearchUrl(keyword),
  }
  const sourceLabel: Record<RadarSourceId, string> = {
    google: 'Google News',
    bing: 'Bing News',
    baidu: '百度资讯',
    yahoo: 'Yahoo News',
    hackernews: 'Hacker News',
    reddit: 'Reddit',
    devto: 'DEV.to',
    medium: 'Medium',
    zhihu: '知乎',
    v2ex: 'V2EX',
    lobsters: 'Lobsters',
    juejin: '掘金',
    csdn: 'CSDN',
    github: 'GitHub',
    wechat: '微信公众号',
    sogou: '搜狗资讯',
    duckduckgo: 'DuckDuckGo',
    yandex: 'Yandex News',
    oschina: '开源中国',
    '36kr': '36氪',
  }

  // HTML-based sources
  if (htmlUrlMap[sourceId]) {
    const retries = SOURCE_RETRIES[sourceId] || 1
    const html = await fetchXml(htmlUrlMap[sourceId]!, retries)
    const htmlParsers: Partial<Record<RadarSourceId, (h: string, kw: string) => FeedItem[]>> = {
      sogou: parseSogouHtml,
      duckduckgo: parseDuckDuckGoHtml,
      yandex: parseYandexHtml,
      zhihu: parseZhihuHtml,
      wechat: parseWechatHtml,
    }
    const parser = htmlParsers[sourceId]
    return parser ? parser(html, keyword) : []
  }

  // Dev.to JSON API
  if (sourceId === 'devto') {
    return fetchDevtoArticles(keyword)
  }

  // Juejin JSON API
  if (sourceId === 'juejin') {
    return fetchJuejinArticles(keyword)
  }

  // CSDN JSON API
  if (sourceId === 'csdn') {
    return fetchCsdnArticles(keyword)
  }

  // GitHub JSON API
  if (sourceId === 'github') {
    return fetchGithubRepos(keyword)
  }

  // Baidu: try RSS first, fall back to HTML parsing
  if (sourceId === 'baidu') {
    try {
      const xml = await fetchXml(rssUrlMap[sourceId]!, 0)
      const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
      const rssItems: FeedItem[] = []
      let rm: RegExpExecArray | null
      while ((rm = itemRe.exec(xml)) !== null && rssItems.length < MAX_FEED_ITEMS) {
        const block = rm[1]
        const title = getTagText(block, 'title')
        const link = getTagText(block, 'link') || (block.match(/<link>([^<]+)<\/link>/i)?.[1] ?? '')
        const summary = getTagText(block, 'description')
        const pubDate = getTagText(block, 'pubDate')
        if (!title || !link) continue
        rssItems.push({
          title,
          link,
          summary: toSummary(summary),
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: '百度资讯',
          keywords: [keyword],
        })
      }
      if (rssItems.length > 0) return rssItems
    } catch {
      /* RSS failed, try HTML fallback */
    }
    // HTML fallback
    try {
      const html = await fetchXml(buildBaiduNewsHtmlUrl(keyword), 2)
      return parseBaiduNewsHtml(html, keyword)
    } catch {
      return []
    }
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
    // For sources that don't filter server-side (e.g. V2EX), filter by keyword match
    const needsClientFilter = sourceId === 'v2ex'
    if (needsClientFilter) {
      const haystack = normalizeKeyword(`${title} ${summary}`)
      if (!haystack.includes(normalizeKeyword(keyword))) continue
    }
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

/** Fetch and extract main body text from an article URL (best-effort, for enrichment) */
async function fetchArticleBody(url: string, maxChars = 500): Promise<string> {
  try {
    const html = await fetchXml(url, 0) // no retry for enrichment
    // Remove script, style, nav, header, footer tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    // Try to extract article/main content first
    const articleMatch = cleaned.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const body = articleMatch ? articleMatch[1] : cleaned
    // Extract paragraphs
    const paragraphs: string[] = []
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let m: RegExpExecArray | null
    while ((m = pRe.exec(body)) !== null) {
      const text = stripHtml(m[1]).trim()
      if (text.length > 20) paragraphs.push(text)
    }
    const result = paragraphs.join(' ').slice(0, maxChars)
    return result.length > 40 ? result : ''
  } catch {
    return ''
  }
}

/** Enrich items with article body text (concurrent, best-effort) */
async function enrichItemBodies(items: FeedItem[], maxItems = 8): Promise<void> {
  const limit = createLimiter(3)
  // Skip items that already have bodyText or have sufficiently detailed summaries
  const targets = items
    .slice(0, maxItems)
    .filter((item) => !item.bodyText && item.link && (!item.summary || item.summary.length < 100))
  await Promise.allSettled(
    targets.map((item) =>
      limit(async () => {
        const body = await fetchArticleBody(item.link)
        if (body) item.bodyText = body
      })
    )
  )
}

async function fetchCustomFeed(feedUrl: string, keywords: string[]): Promise<FeedItem[]> {
  let xml: string
  try {
    xml = await fetchXml(feedUrl)
  } catch (e) {
    console.warn(`[radar] 自定义 RSS 获取失败 ${feedUrl}: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
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
    try {
      items.push({
        title,
        link,
        summary: toSummary(summary),
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
        source: new URL(feedUrl).host,
        keywords: matched,
      })
    } catch {
      continue
    }
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
      COALESCE(keywordRadarStandardMarkdown, 1) as keywordRadarStandardMarkdown,
      COALESCE(keywordRadarPrompt, '') as keywordRadarPrompt,
      COALESCE(keywordRadarLastRunAt, '') as keywordRadarLastRunAt,
      COALESCE(keywordRadarLastStatus, '') as keywordRadarLastStatus,
      COALESCE(keywordRadarLastMessage, '') as keywordRadarLastMessage,
      COALESCE(keywordRadarLastPostId, '') as keywordRadarLastPostId,
      COALESCE(keywordRadarMaxItems, 12) as keywordRadarMaxItems,
      COALESCE(keywordRadarKeepDays, 14) as keywordRadarKeepDays,
      COALESCE(keywordRadarSources, '["google"]') as keywordRadarSources,
      COALESCE(keywordRadarCustomSourceTemplates, '[]') as keywordRadarCustomSourceTemplates,
      COALESCE(keywordRadarWebhookUrl, '') as keywordRadarWebhookUrl,
      COALESCE(keywordRadarWebhookEnabled, 0) as keywordRadarWebhookEnabled,
      COALESCE(keywordRadarUseShortLinks, 0) as keywordRadarUseShortLinks
     FROM SiteConfig WHERE id = 'singleton'`
  )
  return rowToConfig(rows[0])
}

export async function saveKeywordRadarConfig(input: Partial<KeywordRadarConfig>) {
  await ensureSiteConfigRow()
  const current = await getKeywordRadarConfig()
  const next: KeywordRadarConfig = {
    ...current,
    ...input,
    keywords: input.keywords !== undefined ? parseArray(input.keywords) : current.keywords,
    tags: input.tags !== undefined ? parseArray(input.tags) : current.tags,
    extraFeeds: input.extraFeeds !== undefined ? parseArray(input.extraFeeds) : current.extraFeeds,
    includeDomains: input.includeDomains !== undefined ? parseArray(input.includeDomains) : current.includeDomains,
    excludeDomains: input.excludeDomains !== undefined ? parseArray(input.excludeDomains) : current.excludeDomains,
    sources: input.sources
      ? (parseArray(input.sources) as RadarSourceId[]).filter((s) => RADAR_SOURCES.some((d) => d.id === s))
      : current.sources,
    customSourceTemplates:
      input.customSourceTemplates !== undefined
        ? parseCustomSourceTemplates(input.customSourceTemplates)
        : current.customSourceTemplates,
    webhookUrl: input.webhookUrl !== undefined ? String(input.webhookUrl || '') : current.webhookUrl,
    webhookEnabled: input.webhookEnabled !== undefined ? Boolean(input.webhookEnabled) : current.webhookEnabled,
    scheduleMinutes: Math.max(15, Number(input.scheduleMinutes ?? current.scheduleMinutes) || 180),
    standardMarkdown: input.standardMarkdown !== undefined ? Boolean(input.standardMarkdown) : current.standardMarkdown,
    maxItems: Math.max(3, Math.min(30, Number(input.maxItems ?? current.maxItems) || 12)),
    keepDays: Math.max(1, Math.min(90, Number(input.keepDays ?? current.keepDays) || 14)),
    maxArticleAgeDays: Math.max(1, Math.min(30, Number(input.maxArticleAgeDays ?? current.maxArticleAgeDays) || 7)),
    useShortLinks: input.useShortLinks !== undefined ? Boolean(input.useShortLinks) : current.useShortLinks,
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
      keywordRadarStandardMarkdown = ?,
      keywordRadarPrompt = ?,
      keywordRadarMaxItems = ?,
      keywordRadarKeepDays = ?,
      keywordRadarSources = ?,
      keywordRadarCustomSourceTemplates = ?,
      keywordRadarWebhookUrl = ?,
      keywordRadarWebhookEnabled = ?,
      keywordRadarUseShortLinks = ?,
      keywordRadarMaxArticleAgeDays = ?
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
    next.standardMarkdown ? 1 : 0,
    next.prompt,
    next.maxItems,
    next.keepDays,
    JSON.stringify(next.sources),
    JSON.stringify(next.customSourceTemplates),
    next.webhookUrl,
    next.webhookEnabled ? 1 : 0,
    next.useShortLinks ? 1 : 0,
    next.maxArticleAgeDays
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
  const highlights = items.slice(0, Math.min(3, config.maxItems)).map((item) => {
    const summary = item.summary ? item.summary.slice(0, 80) : '暂无摘要'
    return `- **${item.title}**：${summary} ${formatRadarLink(item.link, '→ 原文')}`
  })
  const sections = items.slice(0, config.maxItems).map((item, index) => {
    const summaryText = item.summary
      ? item.summary.length > 140
        ? `${item.summary.slice(0, 140)}…`
        : item.summary
      : '该内容暂无详细摘要，建议点击原文了解详情。'
    const sourceNote = /dev\.to|medium|blog|博客/i.test(item.source)
      ? `来自博客 ${item.source}`
      : item.source || '未知来源'
    return [
      `### ${index + 1}. ${item.title}`,
      '',
      summaryText,
      '',
      `- 来源：${sourceNote}`,
      `- 关键词：${item.keywords.join(' / ') || '未匹配'}`,
      `- 时间：${formatPublishedAtLabel(item.publishedAt)}`,
      `- ${formatRadarLink(item.link, '阅读原文')}`,
    ].join('\n')
  })

  return normalizeRadarMarkdown(
    [
      marker,
      `# ${formatDateLabel(dateKey)} 关键词资讯日报`,
      '',
      `> 本期日报围绕 **${keywordLine}** 自动聚合，覆盖新闻与博客，共整理 ${items.length} 条内容。`,
      '',
      '## 今日亮点',
      '',
      ...(highlights.length > 0 ? highlights : ['- 暂无可展示内容']),
      '',
      '## 逐条速读',
      '',
      ...sections,
      '',
      '---',
      '',
      `*以上内容由内容雷达自动聚合生成，信息仅供参考。*`,
    ].join('\n'),
    config,
    dateKey
  )
}

async function generateAiDigestMarkdown(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${AI_CONFIG_SELECT} FROM SiteConfig WHERE id = 'singleton'`
  )
  const cfg = rowToAiFullConfig(rows[0] || {})
  if (!cfg.groqApiKey && !cfg.openrouterApiKey && !cfg.aiModelApiKey) return null

  const marker = makeDigestMarker(dateKey)
  const payload = items
    .slice(0, config.maxItems)
    .map((item, index) => {
      const bodyText = item.bodyText ? item.bodyText.slice(0, 2000) : null
      const lines = [
        `${index + 1}. 标题：${escapeForPrompt(item.title)}`,
        `关键词：${item.keywords.map((k) => escapeForPrompt(k)).join(' / ')}`,
        `来源：${escapeForPrompt(item.source)}`,
        `发布时间：${item.publishedAt}`,
        `摘要：${escapeForPrompt(item.summary) || '无'}`,
      ]
      if (bodyText) {
        lines.push(`正文节选：${escapeForPrompt(bodyText)}`)
      }
      lines.push(`原文链接：${item.link}`)
      return lines.join('\n')
    })
    .join('\n\n')

  // Analyze keyword distribution to help AI group content
  const keywordGroups: Record<string, number> = {}
  for (const item of items) {
    for (const kw of item.keywords) {
      keywordGroups[kw] = (keywordGroups[kw] || 0) + 1
    }
  }
  const keywordHint = Object.entries(keywordGroups)
    .sort((a, b) => b[1] - a[1])
    .map(([kw, cnt]) => `${kw}(${cnt}条)`)
    .join('、')

  const systemPrompt = `你是一位经验丰富的中文科技 / 行业日报编辑。你的工作是将一组原始新闻线索和博客文章整理成一篇"像真正编辑写的日报"，而不是简单的链接列表。
要求：
1. 使用中文输出，文风自然流畅，像站长写给读者的日报。
2. 整体结构：一级标题（含日期）→ 编辑导语（2-3 句话概括今天的整体动态和亮点）→ 若干主题分区（二级标题）→ 编辑点评结尾。
3. 按主题或领域对线索进行分组，每组用一个二级标题概括主题，而非逐条编号。当前线索关键词分布：${keywordHint}，可据此合理分组。
4. 核心要求——提炼与重组：
   - 每条线索用 2-4 句话概括其核心内容和意义，不要只写标题和链接。
   - 如果提供了正文节选，请结合正文节选来生成更丰富的摘要。
   - 用自己的语言重新组织信息，像真正的编辑一样分析和解读。
   - 如果有多条相关线索，合并讨论，指出它们的关联性或趋势。
   - 在每段摘要末尾附上原文链接，格式为 [阅读原文](链接) 或 [来源名称](链接)。
5. 不要编造未提供的事实，但可以适当加入简短的编辑评论和观点。
6. 不输出 YAML，不输出代码块围栏，不输出 HTML 标签。
7. 第一行必须保留这个标记且不要改动：${marker}
8. ${config.standardMarkdown ? '必须使用标准 Markdown 语法输出，只使用标题、段落、列表、强调和 Markdown 链接；不要输出 HTML 标签、表格、裸链接或超长连续文本。所有外链都写成 [文字](链接) 形式。' : '保持清晰可读的 Markdown 结构。'}
9. 来源包括新闻网站和个人博客，对博客文章适当标注"来自博客"或作者名。
10. 输出长度控制：日报总字数建议 800-2000 字（不含链接），不要过短也不要灌水。
11. 确保每个主题分区至少包含一个 Markdown 链接指向原文。`

  const userPrompt = `${config.prompt ? `${config.prompt}\n\n` : ''}关键词：${config.keywords.join('、')}\n标签：${config.tags.join('、')}\n日期：${formatDateLabel(dateKey)}\n\n线索如下：\n\n${payload}`

  const result = await callAi(
    'postPolish',
    cfg,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 4000, temperature: 0.4 }
  )
  return normalizeRadarMarkdown(result && result.includes(marker) ? result : `${marker}\n\n${result}`, config, dateKey)
}

async function buildRadarDigestContent(items: FeedItem[], config: KeywordRadarConfig, dateKey: string) {
  const digestItems = items.slice(0, config.maxItems)
  if (!config.useAi) {
    return {
      content: fallbackDigestMarkdown(digestItems, config, dateKey),
      mode: 'fallback',
      reason: '已关闭 AI 生成功能',
    } satisfies DigestBuildResult
  }

  try {
    const aiContent = await generateAiDigestMarkdown(digestItems, config, dateKey)
    if (!aiContent) {
      return {
        content: strictFallbackDigestMarkdown(digestItems, config, dateKey),
        mode: 'strict-fallback',
        reason: '未配置可用 AI',
      } satisfies DigestBuildResult
    }
    const quality = inspectAiDigestQuality(aiContent, config)
    if (!quality.ok) {
      return {
        content: strictFallbackDigestMarkdown(digestItems, config, dateKey),
        mode: 'strict-fallback',
        reason: `AI 输出结构不稳定：${quality.reason}`,
      } satisfies DigestBuildResult
    }
    return { content: aiContent, mode: 'ai' } satisfies DigestBuildResult
  } catch (error) {
    return {
      content: strictFallbackDigestMarkdown(digestItems, config, dateKey),
      mode: 'strict-fallback',
      reason: error instanceof Error ? error.message : 'AI 调用失败',
    } satisfies DigestBuildResult
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
  // Enrich items with article body text for better AI summarization
  if (config.useAi) await enrichItemBodies(digestItems)
  // Shorten links if enabled
  const finalItems = await shortenItemLinks(digestItems, config)
  const digest = await buildRadarDigestContent(finalItems, config, dateKey)
  const content = digest.content
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
    const wasAlreadyPublished = Boolean(existing[0].published)
    const newTagSlugs = new Set(tagNames.map((t) => slugify(t)))
    const existingTags = await prisma.tagsOnPosts.findMany({
      where: { postId: existing[0].id },
      include: { tag: true },
    })
    const tagsToDelete = existingTags.filter((tp) => !newTagSlugs.has(tp.tag.slug))
    if (tagsToDelete.length > 0) {
      await prisma.tagsOnPosts.deleteMany({
        where: { postId: existing[0].id, tagId: { in: tagsToDelete.map((tp) => tp.tagId) } },
      })
    }
    await prisma.post.update({
      where: { id: existing[0].id },
      data: {
        title,
        content,
        excerpt,
        published: wasAlreadyPublished || config.autoPublish,
        publishedAt:
          wasAlreadyPublished || config.autoPublish
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
    return { postId: existing[0].id, mode: digest.mode, reason: digest.reason }
  }

  const rows = await prisma.$queryRawUnsafe<{ nextId: number }[]>(
    `SELECT COALESCE(MAX(publicId), 0) + 1 as nextId FROM Post`
  )
  const publicId = Number(rows[0]?.nextId) || 1
  const baseSlug = `${slugify(title)}-${dateKey}`
  // Ensure unique slug by checking existing and appending suffix if needed
  const slugConflict = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM Post WHERE slug = ? LIMIT 1`,
    baseSlug
  )
  const slug = slugConflict.length > 0 ? `${baseSlug}-${Date.now().toString(36).slice(-4)}` : baseSlug
  const post = await prisma.post.create({
    data: {
      publicId,
      title,
      slug,
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
  return { postId: post.id, mode: digest.mode, reason: digest.reason }
}

/** Send webhook notification (fire-and-forget) */
async function sendWebhookNotification(url: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'KeywordRadar/1.0' },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.warn(`[radar] webhook 响应 ${res.status}`)
  } catch (err) {
    console.warn('[radar] webhook 发送失败:', err instanceof Error ? err.message : err)
  }
}

/** Record source health data point */
async function recordSourceHealth(
  sourceId: string,
  runId: string,
  success: boolean,
  itemCount: number,
  latencyMs: number,
  errorMessage: string
) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO KeywordRadarSourceHealth (sourceId, runId, success, itemCount, latencyMs, errorMessage, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      sourceId,
      runId,
      success ? 1 : 0,
      itemCount,
      latencyMs,
      errorMessage
    )
    // Prune old records (keep last 200 per source)
    await prisma.$executeRawUnsafe(
      `DELETE FROM KeywordRadarSourceHealth WHERE sourceId = ? AND createdAt < (
        SELECT createdAt FROM KeywordRadarSourceHealth WHERE sourceId = ?
        ORDER BY createdAt DESC LIMIT 1 OFFSET 200
      )`,
      sourceId,
      sourceId
    )
  } catch {
    /* ignore health recording errors */
  }
}

/** Check if a source should be auto-degraded (>= 5 consecutive recent failures) */
async function isSourceDegraded(sourceId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ success: number }[]>(
      `SELECT success FROM KeywordRadarSourceHealth WHERE sourceId = ? ORDER BY createdAt DESC LIMIT 5`,
      sourceId
    )
    if (rows.length < 5) return false
    if (rows[0].success) return false
    return rows.every((r) => !r.success)
  } catch {
    return false
  }
}

/** Get health summary for all sources */
export async function getSourceHealthSummary(): Promise<
  Array<{
    sourceId: string
    label: string
    total: number
    successCount: number
    failCount: number
    successRate: number
    avgLatencyMs: number
    lastError: string
    degraded: boolean
  }>
> {
  const sources = [...RADAR_SOURCES]
  const results = []
  for (const src of sources) {
    const stats = await prisma.$queryRawUnsafe<
      { total: number; successCount: number; failCount: number; avgLatency: number; lastError: string }[]
    >(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failCount,
        AVG(latencyMs) as avgLatency,
        COALESCE((SELECT errorMessage FROM KeywordRadarSourceHealth WHERE sourceId = ? AND success = 0 ORDER BY createdAt DESC LIMIT 1), '') as lastError
       FROM KeywordRadarSourceHealth WHERE sourceId = ?`,
      src.id,
      src.id
    )
    const s = stats[0] || { total: 0, successCount: 0, failCount: 0, avgLatency: 0, lastError: '' }
    const degraded = await isSourceDegraded(src.id)
    results.push({
      sourceId: src.id,
      label: src.label,
      total: Number(s.total) || 0,
      successCount: Number(s.successCount) || 0,
      failCount: Number(s.failCount) || 0,
      successRate: s.total ? Math.round((Number(s.successCount) / Number(s.total)) * 100) : 0,
      avgLatencyMs: Math.round(Number(s.avgLatency) || 0),
      lastError: String(s.lastError || ''),
      degraded,
    })
  }
  return results
}

/** Get radar statistics for visualization */
export async function getRadarStats(): Promise<{
  dailyTrend: Array<{ date: string; count: number }>
  keywordFrequency: Array<{ keyword: string; count: number }>
  sourceDistribution: Array<{ source: string; count: number }>
  totalItems: number
  totalDays: number
}> {
  // Daily trend (last 30 days)
  const dailyRows = await prisma.$queryRawUnsafe<{ date: string; cnt: number }[]>(
    `SELECT digestDate as date, COUNT(*) as cnt
     FROM KeywordRadarSeen
     WHERE createdAt >= datetime('now', '-30 days')
     GROUP BY digestDate ORDER BY digestDate DESC LIMIT 30`
  )
  // Keyword frequency
  const allKeywordRows = await prisma.$queryRawUnsafe<{ keywords: string }[]>(
    `SELECT keywords FROM KeywordRadarSeen WHERE createdAt >= datetime('now', '-30 days')`
  )
  const kwCount: Record<string, number> = {}
  for (const row of allKeywordRows) {
    try {
      const kws = JSON.parse(String(row.keywords || '[]')) as string[]
      for (const kw of kws) {
        kwCount[kw] = (kwCount[kw] || 0) + 1
      }
    } catch {
      /* ignore */
    }
  }
  // Source distribution
  const sourceRows = await prisma.$queryRawUnsafe<{ source: string; cnt: number }[]>(
    `SELECT source, COUNT(*) as cnt
     FROM KeywordRadarSeen
     WHERE createdAt >= datetime('now', '-30 days')
     GROUP BY source ORDER BY cnt DESC LIMIT 20`
  )
  // Totals
  const totalRows = await prisma.$queryRawUnsafe<{ total: number; days: number }[]>(
    `SELECT COUNT(*) as total, COUNT(DISTINCT digestDate) as days FROM KeywordRadarSeen`
  )
  return {
    dailyTrend: dailyRows.map((r) => ({ date: r.date, count: Number(r.cnt) })),
    keywordFrequency: Object.entries(kwCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count })),
    sourceDistribution: sourceRows.map((r) => ({ source: r.source, count: Number(r.cnt) })),
    totalItems: Number(totalRows[0]?.total) || 0,
    totalDays: Number(totalRows[0]?.days) || 0,
  }
}

async function collectItems(
  config: KeywordRadarConfig,
  logger: (level: 'info' | 'success' | 'error', message: string) => void,
  runId = ''
) {
  const activeSources = config.sources.length > 0 ? config.sources : (['google'] as RadarSourceId[])
  // Auto-degrade: check which sources are healthy
  const degradedSources = new Set<string>()
  for (const sourceId of activeSources) {
    if (await isSourceDegraded(sourceId)) {
      degradedSources.add(sourceId)
      const srcLabel = RADAR_SOURCES.find((s) => s.id === sourceId)?.label || sourceId
      logger('error', `${srcLabel} 已自动降级（连续5次失败），本轮跳过`)
    }
  }
  const healthySources = activeSources.filter((s) => !degradedSources.has(s))
  if (healthySources.length === 0 && activeSources.length > 0) {
    logger('error', '所有源均已降级，强制使用第一个源尝试恢复')
    healthySources.push(activeSources[0])
  }
  const taskDefs: Array<{ label: string; sourceId: string; run: () => Promise<FeedItem[]> }> = []
  for (const keyword of config.keywords) {
    for (const sourceId of healthySources) {
      const srcLabel = RADAR_SOURCES.find((s) => s.id === sourceId)?.label || sourceId
      taskDefs.push({
        label: `${srcLabel} · ${keyword}`,
        sourceId,
        run: () => fetchFeedByKeyword(keyword, sourceId),
      })
    }
  }
  for (const feedUrl of config.extraFeeds) {
    taskDefs.push({ label: `RSS ${feedUrl}`, sourceId: 'custom', run: () => fetchCustomFeed(feedUrl, config.keywords) })
  }
  for (const tmpl of config.customSourceTemplates) {
    for (const keyword of config.keywords) {
      const url = tmpl.urlTemplate.replace(/\{keyword\}/g, encodeURIComponent(keyword))
      taskDefs.push({
        label: `${tmpl.name} · ${keyword}`,
        sourceId: `tmpl:${tmpl.name}`,
        run: () => fetchCustomFeed(url, [keyword]),
      })
    }
  }
  logger(
    'info',
    `开始抓取 ${taskDefs.length} 个来源（并发上限 3）${degradedSources.size > 0 ? `（${degradedSources.size} 个已降级）` : ''}`
  )
  // Rate-limited concurrent execution with timing and per-task timeout
  const limit = createLimiter(3)
  const timings: number[] = []
  const PER_TASK_TIMEOUT = 30000 // 30s hard limit per task
  const settled = await Promise.allSettled(
    taskDefs.map((def) =>
      limit(async () => {
        const start = Date.now()
        try {
          const result = await Promise.race([
            def.run(),
            new Promise<FeedItem[]>((_, reject) =>
              setTimeout(() => reject(new Error('单任务超时 30s')), PER_TASK_TIMEOUT)
            ),
          ])
          timings.push(Date.now() - start)
          return result
        } catch (err) {
          timings.push(Date.now() - start)
          throw err
        }
      })
    )
  )
  const deduped = new Map<string, FeedItem>()
  for (let index = 0; index < settled.length; index++) {
    const result = settled[index]
    const label = taskDefs[index]?.label || `来源 ${index + 1}`
    const sourceId = taskDefs[index]?.sourceId || 'unknown'
    const latency = timings[index] || 0
    if (result.status !== 'fulfilled') {
      const errMsg = result.reason instanceof Error ? result.reason.message : '未知错误'
      logger('error', `${label} 抓取失败（${latency}ms）：${errMsg}`)
      recordSourceHealth(sourceId, runId, false, 0, latency, errMsg)
      continue
    }
    logger('success', `${label} 抓取完成（${latency}ms），命中 ${result.value.length} 条`)
    recordSourceHealth(sourceId, runId, true, result.value.length, latency, '')
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
  // Per-source statistics summary
  const stats: Record<string, { ok: number; fail: number; items: number }> = {}
  for (let i = 0; i < taskDefs.length; i++) {
    const label = taskDefs[i].label.split(' · ')[0] || taskDefs[i].label
    if (!stats[label]) stats[label] = { ok: 0, fail: 0, items: 0 }
    if (settled[i].status === 'fulfilled') {
      stats[label].ok++
      stats[label].items += (settled[i] as PromiseFulfilledResult<FeedItem[]>).value.length
    } else {
      stats[label].fail++
    }
  }
  const statsLines = Object.entries(stats).map(([src, s]) => {
    const status = s.fail > 0 ? `${s.ok}✓ ${s.fail}✗` : `${s.ok}✓`
    return `${src}: ${status}，共 ${s.items} 条`
  })
  logger('info', `抓取统计：${statsLines.join(' | ')}`)
  logger('info', `链接去重后共 ${deduped.size} 条`)
  const linkDeduped = Array.from(deduped.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
  const titleDeduped = dedupeBySimilarTitle(linkDeduped)
  if (titleDeduped.length < linkDeduped.length) {
    logger(
      'info',
      `标题相似度去重合并 ${linkDeduped.length - titleDeduped.length} 条，最终 ${titleDeduped.length} 条待处理`
    )
  } else {
    logger('info', `去重后共 ${titleDeduped.length} 条待处理`)
  }
  const maxAge = config.maxArticleAgeDays * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - maxAge
  const freshItems = titleDeduped.filter((item) => {
    const itemTime = new Date(item.publishedAt).getTime()
    return !isNaN(itemTime) && itemTime >= cutoff
  })
  if (freshItems.length < titleDeduped.length) {
    logger(
      'info',
      `时效性过滤（${config.maxArticleAgeDays} 天内）：过滤 ${titleDeduped.length - freshItems.length} 条旧文章，剩余 ${freshItems.length} 条`
    )
  }
  return freshItems
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
  // eslint-disable-next-line no-var
  var __keywordRadarRunning: Promise<KeywordRadarRunResult> | null | undefined
  // eslint-disable-next-line no-var
  var __keywordRadarPreviewRunning: Promise<KeywordRadarPreviewResult> | null | undefined
}

export async function runKeywordRadar(options: { reason: 'manual' | 'scheduler' }): Promise<KeywordRadarRunResult> {
  if (globalThis.__keywordRadarRunning) return globalThis.__keywordRadarRunning

  const promise = (async () => {
    const runId = startKeywordRadarLog(options.reason)
    const log = (level: 'info' | 'success' | 'error', message: string) => {
      appendKeywordRadarLog(runId, level, message, options.reason)
    }
    await ensureSiteConfigRow()
    const config = await getKeywordRadarConfig()
    const nowIso = new Date().toISOString()
    const dateKey = getTodayKey()
    clearFetchCache()
    log('info', `开始执行内容雷达（${options.reason === 'manual' ? '手动触发' : '定时触发'}）`)

    if (options.reason === 'scheduler' && !config.enabled) {
      log('info', '定时抓取未启用，跳过本次执行')
      finishKeywordRadarLog(runId)
      return { ok: true, skipped: true, message: '内容雷达未启用', matchedCount: 0, newCount: 0, digestDate: dateKey }
    }

    if (options.reason === 'scheduler' && config.lastRunAt) {
      const elapsed = Date.now() - new Date(config.lastRunAt).getTime()
      const baseInterval = config.scheduleMinutes * 60 * 1000
      const adaptiveInterval = config.lastStatus === 'idle' ? baseInterval * 1.5 : baseInterval
      if (elapsed < adaptiveInterval) {
        const nextRunIn = Math.ceil((adaptiveInterval - elapsed) / 60000)
        log(
          'info',
          `未到下一次执行时间（约 ${nextRunIn} 分钟后），跳过本次定时抓取${config.lastStatus === 'idle' ? '（上次无新内容，已自动延长间隔）' : ''}`
        )
        finishKeywordRadarLog(runId)
        return {
          ok: true,
          skipped: true,
          message: `未到下一次执行时间（约 ${nextRunIn} 分钟后）`,
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
      const matchedItems = await collectItems(config, log, runId)
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
      let digestPost: { postId: string; mode: string; reason?: string } | null = null
      try {
        digestPost = await upsertDailyDigest(newItems, config, dateKey)
      } catch (digestError) {
        log('error', `日报生成失败：${digestError instanceof Error ? digestError.message : String(digestError)}`)
        await attachPostId(dateKey, '')
        throw digestError
      }
      const postId = digestPost.postId
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
      if (digestPost.mode === 'strict-fallback' && digestPost.reason) {
        log('info', `已自动切换到严格模板：${digestPost.reason}`)
      } else if (digestPost.mode === 'fallback' && digestPost.reason) {
        log('info', `已使用普通模板：${digestPost.reason}`)
      } else {
        log('success', 'AI 输出通过质量检查，已直接用于生成日报')
      }
      log('success', `日报已生成，文章 ID：${postId}`)
      log('success', `执行完成：命中 ${matchedItems.length} 条，新增 ${newItems.length} 条`)
      if (config.webhookEnabled && config.webhookUrl) {
        sendWebhookNotification(config.webhookUrl, {
          event: 'radar_completed',
          matchedCount: matchedItems.length,
          newCount: newItems.length,
          digestDate: dateKey,
          postId,
          message: `内容雷达已执行：新增 ${newItems.length} 条，日报文章 ${postId}`,
        }).catch(() => {})
      }
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
  })().then(
    (result) => {
      globalThis.__keywordRadarRunning = null
      return result
    },
    (err) => {
      globalThis.__keywordRadarRunning = null
      throw err
    }
  )

  globalThis.__keywordRadarRunning = promise
  return promise
}

export async function previewKeywordRadarDigest(): Promise<KeywordRadarPreviewResult> {
  if (globalThis.__keywordRadarPreviewRunning) return globalThis.__keywordRadarPreviewRunning

  const promise = (async (): Promise<KeywordRadarPreviewResult> => {
    await ensureSiteConfigRow()
    const config = await getKeywordRadarConfig()
    const dateKey = getTodayKey()

    if (config.keywords.length === 0 && config.extraFeeds.length === 0) {
      return {
        ok: false,
        message: '未配置关键词或额外 RSS 源',
        matchedCount: 0,
        newCount: 0,
        digestDate: dateKey,
        content: '',
      }
    }

    const matchedItems = await collectItems(config, () => {}, `preview-${Date.now()}`)
    const newItems = await getNewItems(matchedItems)
    const previewItems = (newItems.length > 0 ? newItems : matchedItems).slice(0, config.maxItems)
    await insertSeenItems(previewItems, dateKey)
    if (config.useAi) await enrichItemBodies(previewItems)
    const finalItems = await shortenItemLinks(previewItems, config)
    const digest = await buildRadarDigestContent(finalItems, config, dateKey)
    const content = digest.content

    return {
      ok: true,
      message:
        (newItems.length > 0 ? `已预览 ${newItems.length} 条新增内容` : '当前没有新增内容，展示的是候选内容预览') +
        (digest.mode === 'strict-fallback' && digest.reason ? `；已切换严格模板：${digest.reason}` : ''),
      matchedCount: matchedItems.length,
      newCount: newItems.length,
      digestDate: dateKey,
      content,
    }
  })().then(
    (result) => {
      globalThis.__keywordRadarPreviewRunning = null
      return result
    },
    (err) => {
      globalThis.__keywordRadarPreviewRunning = null
      throw err
    }
  )

  globalThis.__keywordRadarPreviewRunning = promise
  return promise
}
