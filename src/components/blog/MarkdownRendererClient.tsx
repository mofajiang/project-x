'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import 'highlight.js/styles/github-dark.css'
import { InternalQuoteCard, ExternalQuoteCard } from './QuoteCard'

// 解析引用语法，将特殊行转为占位符，渲染时替换为组件
function parseQuotes(content: string): { segments: Array<{ type: 'md' | 'internal' | 'external'; content: string; url?: string; title?: string; desc?: string }> } {
  const lines = content.split('\n')
  const segments: Array<{ type: 'md' | 'internal' | 'external'; content: string; url?: string; title?: string; desc?: string }> = []
  let mdBuffer: string[] = []

  for (const line of lines) {
    // ::quote[slug] — 站内文章引用
    const internalMatch = line.match(/^::quote\[([^\]]+)\]\s*$/)
    if (internalMatch) {
      if (mdBuffer.length) { segments.push({ type: 'md', content: mdBuffer.join('\n') }); mdBuffer = [] }
      segments.push({ type: 'internal', content: internalMatch[1].trim() })
      continue
    }
    // ::quote-url[url] or ::quote-url[url "title" "desc"]
    const externalMatch = line.match(/^::quote-url\[([^\]]+)\]\s*$/)
    if (externalMatch) {
      if (mdBuffer.length) { segments.push({ type: 'md', content: mdBuffer.join('\n') }); mdBuffer = [] }
      const raw = externalMatch[1].trim()
      // 格式: url "title" "desc"
      const parts = raw.match(/^(\S+)(?:\s+"([^"]+)")?(?:\s+"([^"]+)")?/)
      segments.push({ type: 'external', content: raw, url: parts?.[1] || raw, title: parts?.[2], desc: parts?.[3] })
      continue
    }
    mdBuffer.push(line)
  }
  if (mdBuffer.length) segments.push({ type: 'md', content: mdBuffer.join('\n') })
  return { segments }
}

export default function MarkdownRendererClient({ content }: { content: string }) {
  const isHtml = content.trimStart().startsWith('<')
  if (isHtml) {
    return <div className="prose-x" dangerouslySetInnerHTML={{ __html: content }} />
  }

  const { segments } = parseQuotes(content)

  return (
    <div className="prose-x markdown-body">
      {segments.map((seg, i) => {
        if (seg.type === 'internal') {
          return <InternalQuoteCard key={i} slug={seg.content} />
        }
        if (seg.type === 'external') {
          return <ExternalQuoteCard key={i} url={seg.url!} />
        }
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
          >
            {seg.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
