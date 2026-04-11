'use client'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import DOMPurify from 'dompurify'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import nginx from 'highlight.js/lib/languages/nginx'
import 'highlight.js/styles/github-dark.css'
import { InternalQuoteCard, ExternalQuoteCard } from './QuoteCard'
import { looksLikeHtmlContent } from '@/lib/post-utils'

const lowlight = createLowlight()
lowlight.register('javascript', javascript)
lowlight.register('js', javascript)
lowlight.register('typescript', typescript)
lowlight.register('ts', typescript)
lowlight.register('python', python)
lowlight.register('bash', bash)
lowlight.register('sh', bash)
lowlight.register('shell', bash)
lowlight.register('json', json)
lowlight.register('css', css)
lowlight.register('html', xml)
lowlight.register('xml', xml)
lowlight.register('sql', sql)
lowlight.register('yaml', yaml)
lowlight.register('yml', yaml)
lowlight.register('markdown', markdown)
lowlight.register('md', markdown)
lowlight.register('go', go)
lowlight.register('rust', rust)
lowlight.register('java', java)
lowlight.register('cpp', cpp)
lowlight.register('c', cpp)
lowlight.register('dockerfile', dockerfile)
lowlight.register('docker', dockerfile)
lowlight.register('nginx', nginx)

// 解析引用语法，将特殊行转为占位符，渲染时替换为组件
function parseQuotes(content: string): {
  segments: Array<{
    type: 'md' | 'internal' | 'external'
    content: string
    url?: string
    title?: string
    desc?: string
  }>
} {
  const lines = content.split('\n')
  const segments: Array<{
    type: 'md' | 'internal' | 'external'
    content: string
    url?: string
    title?: string
    desc?: string
  }> = []
  let mdBuffer: string[] = []

  for (const line of lines) {
    // ::quote[slug] — 站内文章引用
    const internalMatch = line.match(/^::quote\[([^\]]+)\]\s*$/)
    if (internalMatch) {
      if (mdBuffer.length) {
        segments.push({ type: 'md', content: mdBuffer.join('\n') })
        mdBuffer = []
      }
      segments.push({ type: 'internal', content: internalMatch[1].trim() })
      continue
    }
    // ::quote-url[url] or ::quote-url[url "title" "desc"]
    const externalMatch = line.match(/^::quote-url\[([^\]]+)\]\s*$/)
    if (externalMatch) {
      if (mdBuffer.length) {
        segments.push({ type: 'md', content: mdBuffer.join('\n') })
        mdBuffer = []
      }
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

// 将 HTML 内容按 data-quote-url / data-quote-post 节点拆分
function parseHtmlQuotes(html: string): Array<{ type: 'html' | 'quote-url' | 'quote-post'; content: string }> {
  const segments: Array<{ type: 'html' | 'quote-url' | 'quote-post'; content: string }> = []
  const re = /<div\s+(data-quote-url|data-quote-post)="([^"]*)"[^>]*>[\s\S]*?<\/div>/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIndex) {
      const chunk = html.slice(lastIndex, m.index)
      if (chunk.trim()) segments.push({ type: 'html', content: chunk })
    }
    if (m[2]) {
      segments.push({ type: m[1] === 'data-quote-url' ? 'quote-url' : 'quote-post', content: m[2] })
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < html.length) {
    const chunk = html.slice(lastIndex)
    if (chunk.trim()) segments.push({ type: 'html', content: chunk })
  }
  return segments
}

export default function MarkdownRendererClient({ content }: { content: string }) {
  const isHtml = looksLikeHtmlContent(content)
  if (isHtml) {
    const htmlSegments = parseHtmlQuotes(content)
    if (htmlSegments.some((s) => s.type === 'quote-url' || s.type === 'quote-post')) {
      return (
        <div className="prose-x">
          {htmlSegments.map((seg, i) => {
            if (seg.type === 'quote-url') return <ExternalQuoteCard key={i} url={seg.content} />
            if (seg.type === 'quote-post') return <InternalQuoteCard key={i} slug={seg.content} />
            return <div key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(seg.content) }} />
          })}
        </div>
      )
    }
    return <div className="prose-x" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
  }

  const { segments } = useMemo(() => parseQuotes(content), [content])

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
            rehypePlugins={[[rehypeHighlight, { lowlight }], rehypeRaw]}
          >
            {seg.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
