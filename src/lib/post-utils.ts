export interface QuoteSegment {
  type: 'internal' | 'external'
  value: string
}

export function extractQuotes(md: string): QuoteSegment[] {
  const results: QuoteSegment[] = []
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
  return md
    .replace(/^::quote-url\[[^\]]+\]\s*$/gm, '')
    .replace(/^::quote\[[^\]]+\]\s*$/gm, '')
    .replace(/```[\s\S]*?```/g, '[代码]')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
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
