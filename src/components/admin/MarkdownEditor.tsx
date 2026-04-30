'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import { useTheme } from '@/hooks/useTheme'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  value: string
  onChange: (val: string) => void
  initialHeight?: number
}

export function MarkdownEditor({ value, onChange, initialHeight = 500 }: Props) {
  const theme = useTheme()
  const [isMobile, setIsMobile] = useState(false)
  const [editorHeight, setEditorHeight] = useState(initialHeight)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 // md breakpoint
      setIsMobile(mobile)
      
      // 响应式计算高度：总高度 - 顶部导航 - 底部导航 - 表单其他内容
      if (mobile) {
        // 移动端：屏幕高度 - 56px(顶部) - 240px(底部nav + 按钮) - 其他表单内容
        const availableHeight = Math.max(300, window.innerHeight - 56 - 240 - 150)
        setEditorHeight(availableHeight)
      } else {
        // 桌面端
        const availableHeight = Math.max(400, window.innerHeight - 200)
        setEditorHeight(Math.min(availableHeight, 600))
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div data-color-mode={theme}>
      <MDEditor
        value={value}
        onChange={v => onChange(v || '')}
        height={editorHeight}
        preview={isMobile ? "edit" : "live"}
        visibleDragbar={!isMobile}
        style={{ background: 'var(--bg-secondary)', borderRadius: '12px' }}
      />
    </div>
  )
}
