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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (FriendLinkChecker/1.0)',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

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
 * 除了检查提供的 URL 外，还会搜索常见的友链页面
 */
export async function checkFriendLinkOnTargetSite(
  targetUrl: string,
  myDomain: string
): Promise<CheckResult> {
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

  // 如果提供的是首页，继续检查常见的友链页面路径
  const isHomePage = urlObj.pathname === '/' || urlObj.pathname === ''
  if (isHomePage) {
    const commonPaths = [
      '/links',
      '/friends',
      '/blogroll',
      '/link',
      '/friend',
      '/友链',
    ]

    for (const path of commonPaths) {
      const checkUrl = `${urlObj.origin}${path}`
      const result = await checkPageForLink(checkUrl, myDomain)
      if (result.found) return result
      // 如果页面不存在（404）则继续尝试下一个，其他错误也跳过
    }
  }

  // 保留首次检查的错误信息（如果有）
  return mainResult.error ? mainResult : { found: false }
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        valid: false,
        error: `网站返回 ${response.status}`,
      }
    }

    return { valid: true }
  } catch (error) {
    // HEAD 可能不被支持，再试 GET
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
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
