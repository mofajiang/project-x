/**
 * RSS / Atom 订阅抓取与解析工具
 * 支持 RSS 2.0 和 Atom 1.0
 */

export interface FeedItem {
  title: string
  link: string
  summary: string
  publishedAt: string // ISO string
  blogName: string
  blogUrl: string
  favicon?: string
}

const FETCH_TIMEOUT_MS = 8000
const MAX_ITEMS_PER_FEED = 5

/** 从 XML 文本中提取标签内容（单标签，不嵌套） */
function getTagText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return ''
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** 移除常见 HTML 标签，截取摘要 */
function toSummary(raw: string, maxLen = 120): string {
  const text = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

/** 解析 RSS 2.0 的 <item> 列表 */
function parseRss(xml: string, blogName: string, blogUrl: string, favicon?: string): FeedItem[] {
  const items: FeedItem[] = []
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && items.length < MAX_ITEMS_PER_FEED) {
    const block = m[1]
    const title = getTagText(block, 'title')
    const link = getTagText(block, 'link') || (block.match(/<link>([^<]+)<\/link>/i)?.[1] ?? '')
    const desc = getTagText(block, 'description') || getTagText(block, 'summary')
    const pubDate = getTagText(block, 'pubDate') || getTagText(block, 'published') || getTagText(block, 'updated')
    if (!title || !link) continue
    items.push({
      title,
      link,
      summary: toSummary(desc),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      blogName,
      blogUrl,
      favicon,
    })
  }
  return items
}

/** 解析 Atom 1.0 的 <entry> 列表 */
function parseAtom(xml: string, blogName: string, blogUrl: string, favicon?: string): FeedItem[] {
  const items: FeedItem[] = []
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml)) !== null && items.length < MAX_ITEMS_PER_FEED) {
    const block = m[1]
    const title = getTagText(block, 'title')
    // Atom link: <link href="..." rel="alternate"/>
    const linkHref = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? ''
    const summary = getTagText(block, 'summary') || getTagText(block, 'content')
    const published = getTagText(block, 'published') || getTagText(block, 'updated')
    if (!title || !linkHref) continue
    items.push({
      title,
      link: linkHref,
      summary: toSummary(summary),
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      blogName,
      blogUrl,
      favicon,
    })
  }
  return items
}

/** 尝试常见路径发现 RSS 地址 */
async function discoverRssUrl(siteUrl: string): Promise<string | null> {
  const base = siteUrl.replace(/\/+$/, '')
  const candidates = [
    `${base}/feed`,
    `${base}/feed.xml`,
    `${base}/rss.xml`,
    `${base}/atom.xml`,
    `${base}/rss`,
    `${base}/index.xml`,
  ]
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FriendCircleBot/1.0)' },
      })
      if (r.ok) {
        const ct = r.headers.get('content-type') || ''
        if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) return url
        const text = await r.text()
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel>')) return url
      }
    } catch {
      // 继续尝试下一个
    }
  }
  return null
}

export interface FriendFeedSource {
  name: string
  url: string
  rssUrl?: string
  favicon?: string
}

/** 从单个 RSS 地址抓取并解析条目 */
async function fetchOneFeed(source: FriendFeedSource): Promise<FeedItem[]> {
  let rssUrl = source.rssUrl || ''

  // 如果没设置 RSS URL，尝试自动发现
  if (!rssUrl) {
    rssUrl = (await discoverRssUrl(source.url)) || ''
  }
  if (!rssUrl) return []

  try {
    const res = await fetch(rssUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FriendCircleBot/1.0)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    if (xml.includes('<entry')) {
      return parseAtom(xml, source.name, source.url, source.favicon)
    }
    return parseRss(xml, source.name, source.url, source.favicon)
  } catch {
    return []
  }
}

/** 并发抓取多个友链的 RSS，按发布时间降序返回 */
export async function fetchFriendFeeds(sources: FriendFeedSource[]): Promise<FeedItem[]> {
  const results = await Promise.allSettled(sources.map((s) => fetchOneFeed(s)))
  const all: FeedItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  return all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
