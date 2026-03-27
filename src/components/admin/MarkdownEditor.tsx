'use client'
import dynamic from 'next/dynamic'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import { useTheme } from '@/hooks/useTheme'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  value: string
  onChange: (val: string) => void
}

export function MarkdownEditor({ value, onChange }: Props) {
  const theme = useTheme()
  return (
    <div data-color-mode={theme}>
      <MDEditor
        value={value}
        onChange={v => onChange(v || '')}
        height={500}
        preview="live"
        style={{ background: 'var(--bg-secondary)', borderRadius: '12px' }}
      />
    </div>
  )
}
