import dynamic from 'next/dynamic'

// 禁用 SSR 避免 react-markdown 水合不匹配
const MarkdownRendererClient = dynamic(
  () => import('./MarkdownRendererClient'),
  {
    ssr: false,
    loading: () => <div className="prose-x" style={{ color: 'var(--text-secondary)', minHeight: 100 }}>加载中...</div>,
  }
)

export function MarkdownRenderer({ content }: { content: string }) {
  return <MarkdownRendererClient content={content} />
}
