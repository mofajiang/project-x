import { fetchWithTimeout } from '@/lib/fetch-utils'

export interface CheckResult {
  found: boolean
  foundAt?: string
  checkedUrl?: string
  error?: string
}

/**
 * 在单个页面中搜索是否包含指向我方的链接
 */
async function checkPageForLink(pageUrl: string, myDomain: string): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(
      pageUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (FriendLinkChecker/1.0)',
        },
      },
      8000
    )

    if (!response.ok) {
      return { found: false, error: `网站返回 ${response.status}` }
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('text/html')) {
      return { found: false, error: '非有效的网站内容' }
    }

    let html = await response.text()

    // 限制文本大小（防止加载过大文件）
    if (html.length > 5242880) {
      html = html.slice(0, 5242880)
    }

    // 检查多种 URL 模式
    const patterns = [
      // 完整 URL 匹配
      new RegExp(`href=['"]https?://([^/'"]*)?${myDomain.replace(/\./g, '\\.')}([^'"]*)?['"]`, 'gi'),
      // 简化主机名匹配
      new RegExp(`href=['"]https?://${myDomain.replace(/\./g, '\\.')}([^'"]*)?['"]`, 'gi'),
      // 子域名和 www 变体
      new RegExp(`href=['"]https?://(?:www\\.)?${myDomain.replace(/\./g, '\\.')}([^'"]*)?['"]`, 'gi'),
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match) {
        return {
          found: true,
          foundAt: match[0].slice(0, 120),
          checkedUrl: pageUrl,
        }
      }
    }

    return { found: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : '检查失败'
    if (message.includes('abort')) {
      return { found: false, error: '请求超时' }
    }
    return { found: false, error: message }
  }
}

/**
 * 检查对方网站是否已链接到我方
 * 除了检查提供的 URL 外，还会搜索常见的友链页面和 sitemap
 */
export async function checkFriendLinkOnTargetSite(targetUrl: string, myDomain: string): Promise<CheckResult> {
  // 规范化 URL
  let url = targetUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  // 验证 URL 格式
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return { found: false, error: 'URL 格式无效' }
  }

  // 先检查提供的 URL
  const mainResult = await checkPageForLink(url, myDomain)
  if (mainResult.found) return mainResult

  // 常见的友链页面路径（中英文博客普遍用法）
  const commonPaths = [
    '/links',
    '/links/',
    '/link',
    '/link/',
    '/links.html',
    '/link.html',
    '/friends',
    '/friends/',
    '/friend',
    '/friend/',
    '/friends.html',
    '/friend.html',
    '/blogroll',
    '/blogroll/',
    '/blogroll.html',
    '/nav',
    '/nav/',
    '/about',
    '/about/',
    '/about.html',
    '/关于',
    '/友链',
    '/友情链接',
  ]

  // 如果提交的不是首页，也补充检查首页
  const checkUrls: string[] = []
  const isHomePage = urlObj.pathname === '/' || urlObj.pathname === ''
  if (!isHomePage) {
    checkUrls.push(urlObj.origin + '/')
  }
  for (const path of commonPaths) {
    const checkUrl = urlObj.origin + path
    if (checkUrl !== url) checkUrls.push(checkUrl)
  }

  for (const checkUrl of checkUrls) {
    const result = await checkPageForLink(checkUrl, myDomain)
    if (result.found) return result
  }

  // 最后尝试从 sitemap.xml 中发现友链页面
  try {
    const sitemapResult = await discoverLinkPageFromSitemap(urlObj.origin, myDomain)
    if (sitemapResult.found) return sitemapResult
  } catch {
    // sitemap 检查失败不影响主流程
  }

  return mainResult.error ? mainResult : { found: false }
}

/**
 * 通过 sitemap.xml 发现友链页面，并检查其中是否包含我方链接
 */
async function discoverLinkPageFromSitemap(origin: string, myDomain: string): Promise<CheckResult> {
  const sitemapUrl = `${origin}/sitemap.xml`
  try {
    const response = await fetchWithTimeout(
      sitemapUrl,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (FriendLinkChecker/1.0)' },
      },
      5000
    )

    if (!response.ok) return { found: false }

    const xml = await response.text()
    const urlMatches = xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/gi) || []
    const linkPageKeywords = /friend|link|blogroll|nav|about|友链|友情/i

    for (const match of urlMatches) {
      const loc = match.replace(/<\/?loc>/gi, '').trim()
      if (linkPageKeywords.test(loc)) {
        const result = await checkPageForLink(loc, myDomain)
        if (result.found) return result
      }
    }
  } catch {
    // ignore
  }
  return { found: false }
}

/**
 * 验证 URL 是否有效和可访问
 */
export async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    new URL(url)

    // 尝试获取 HEAD 请求（更快）
    const response = await fetchWithTimeout(
      url,
      {
        method: 'HEAD',
      },
      5000
    )

    if (!response.ok) {
      return {
        valid: false,
        error: `网站返回 ${response.status}`,
      }
    }

    return { valid: true }
  } catch (_error) {
    // HEAD 可能不被支持，再试 GET
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
        },
        5000
      )
      return { valid: response.ok }
    } catch (err) {
      const message = err instanceof Error ? err.message : '检查失败'
      return { valid: false, error: message }
    }
  }
}

/**
 * 从网站获取 favicon
 */
export async function getFavicon(url: string): Promise<string | null> {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    const urlObj = new URL(url)
    // 尝试从站点根目录获取 favicon
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
  } catch {
    return null
  }
}
