export interface QuoteSegment {
  type: 'internal' | 'external'
  value: string
}

export function extractQuotes(md: string): QuoteSegment[] {
  const results: QuoteSegment[] = []
  // HTML content from TipTap
  if (md.trimStart().startsWith('<')) {
    const reUrl = /<div\s+data-quote-url="([^"]+)"[^>]*>/g
    const rePost = /<div\s+data-quote-post="([^"]+)"[^>]*>/g
    let m: RegExpExecArray | null
    while ((m = reUrl.exec(md)) !== null) {
      results.push({ type: 'external', value: m[1] })
    }
    while ((m = rePost.exec(md)) !== null) {
      results.push({ type: 'internal', value: m[1] })
    }
    return results
  }
  for (const line of md.split('\n')) {
    const internal = line.match(/^::quote\[([^\]]+)\]\s*$/)
    if (internal) {
      results.push({ type: 'internal', value: internal[1].trim() })
      continue
    }
    const external = line.match(/^::quote-url\[([^\]]+)\]\s*$/)
    if (external) {
      const url = external[1].trim().match(/^(\S+)/)?.[1] || external[1].trim()
      results.push({ type: 'external', value: url })
    }
  }
  return results
}

export function stripMarkdown(md: string): string {
  if (md.trimStart().startsWith('<')) {
    // HTML content from TipTap
    return md
      .replace(/<img[^>]*>/gi, '[图片]')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  return md
    .replace(/^::quote-url\[[^\]]+\]\s*$/gm, '')
    .replace(/^::quote\[[^\]]+\]\s*$/gm, '')
    .replace(/```[\s\S]*?```/g, '[代码]')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/<img[^>]*>/gi, '') // HTML <img> tags in markdown
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** 从 Markdown 或 HTML 内容中提取所有图片 URL（最多 9 张） */
export function extractImages(md: string): string[] {
  if (!md) return []
  const urls: string[] = []
  if (md.trimStart().startsWith('<')) {
    // HTML content from TipTap
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(md)) !== null && urls.length < 9) {
      if (!urls.includes(m[1])) urls.push(m[1])
    }
    return urls
  }
  const re = /!\[.*?\]\((https?:\/\/[^)\s]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null && urls.length < 9) {
    if (!urls.includes(m[1])) urls.push(m[1])
  }
  // Also handle <img src="..."> tags mixed into markdown (old StorageImagePicker)
  const htmlRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((m = htmlRe.exec(md)) !== null && urls.length < 9) {
    if (!urls.includes(m[1])) urls.push(m[1])
  }
  return urls
}
