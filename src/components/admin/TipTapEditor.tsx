'use client'
import {
  useEditor,
  EditorContent,
  BubbleMenu,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { useEffect, useRef, useState } from 'react'

// QuoteUrl NodeView（编辑器内展示）
function QuoteUrlNodeView({ node, deleteNode }: NodeViewProps) {
  const url = (node.attrs as { url: string }).url
  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="my-2 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'default' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0, color: 'var(--accent)' }}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            引用卡片：{url}
          </span>
        </div>
        <button
          type="button"
          onClick={() => deleteNode()}
          className="ml-3 flex-shrink-0 rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  )
}

// QuoteUrl TipTap 扩展
const QuoteUrl = Node.create({
  name: 'quoteUrl',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-quote-url]',
        getAttrs: (el) => ({ url: (el as HTMLElement).getAttribute('data-quote-url') || '' }),
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-quote-url': HTMLAttributes.url })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuoteUrlNodeView)
  },
})

// QuotePost NodeView（编辑器内展示）
function QuotePostNodeView({ node, deleteNode }: NodeViewProps) {
  const slug = (node.attrs as { slug: string }).slug
  const [preview, setPreview] = useState<{
    title: string
    author: { username: string; displayName?: string | null }
  } | null>(null)

  useEffect(() => {
    fetch(`/api/posts/preview?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPreview(data)
      })
      .catch(() => null)
  }, [slug])

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="my-2 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ border: '1px solid var(--accent)', background: 'var(--bg-secondary)', cursor: 'default' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0, color: 'var(--accent)' }}
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          <span className="truncate text-xs" style={{ color: 'var(--text-primary)' }}>
            {preview
              ? `${preview.author.displayName || preview.author.username}：${preview.title}`
              : `站内引用：${slug}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => deleteNode()}
          className="ml-3 flex-shrink-0 rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  )
}

// QuotePost TipTap 扩展
const QuotePost = Node.create({
  name: 'quotePost',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { slug: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-quote-post]',
        getAttrs: (el) => ({ slug: (el as HTMLElement).getAttribute('data-quote-post') || '' }),
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-quote-post': HTMLAttributes.slug })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuotePostNodeView)
  },
})

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  onImageUpload?: (file: File) => Promise<string>
}

const TOOLBAR_BTN = 'px-2 py-1 rounded text-sm transition-colors hover:bg-white/10 disabled:opacity-30'
const ACTIVE = 'bg-white/15'

export function TipTapEditor({ value, onChange, placeholder = '开始写作...', minHeight = 400, onImageUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // QuotePost 搜索弹窗状态
  const [quotePickerOpen, setQuotePickerOpen] = useState(false)
  const [quotePickerQuery, setQuotePickerQuery] = useState('')
  const [quotePickerResults, setQuotePickerResults] = useState<{ slug: string; title: string; excerpt: string }[]>([])
  const [quotePickerLoading, setQuotePickerLoading] = useState(false)
  const quotePickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!quotePickerOpen) return
    if (!quotePickerQuery.trim()) {
      setQuotePickerResults([])
      return
    }
    setQuotePickerLoading(true)
    if (quotePickerTimerRef.current) clearTimeout(quotePickerTimerRef.current)
    quotePickerTimerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(quotePickerQuery)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setQuotePickerResults(Array.isArray(data) ? data : []))
        .catch(() => setQuotePickerResults([]))
        .finally(() => setQuotePickerLoading(false))
    }, 300)
    return () => {
      if (quotePickerTimerRef.current) clearTimeout(quotePickerTimerRef.current)
    }
  }, [quotePickerQuery, quotePickerOpen])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: 'hljs' } },
      }),
      Underline,
      Image.configure({ allowBase64: false, inline: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      QuoteUrl,
      QuotePost,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose-x outline-none',
        style: `min-height:${minHeight}px; padding: 12px 0;`,
      },
    },
  })

  // 外部 value 变化时同步（如加载草稿）
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleImageFile = async (file: File) => {
    if (!editor) return
    if (onImageUpload) {
      try {
        const url = await onImageUpload(file)
        editor.chain().focus().setImage({ src: url }).run()
      } catch {
        // ignore upload failure
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const src = e.target?.result as string
        if (src) editor.chain().focus().setImage({ src }).run()
      }
      reader.readAsDataURL(file)
    }
  }

  const setLink = () => {
    if (!editor) return
    const previous = editor.getAttributes('link').href
    const url = window.prompt('输入链接 URL', previous || '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }

  const insertQuoteUrl = () => {
    if (!editor) return
    const url = window.prompt('输入要引用的外部链接 URL')
    if (!url?.trim()) return
    editor
      .chain()
      .focus()
      .insertContent({ type: 'quoteUrl', attrs: { url: url.trim() } })
      .run()
  }

  const insertQuotePost = (slug: string) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'quotePost', attrs: { slug } }).run()
    setQuotePickerOpen(false)
    setQuotePickerQuery('')
    setQuotePickerResults([])
  }

  if (!editor) return null

  const b = (action: () => boolean | void, active?: boolean, disabled?: boolean) => ({
    onClick: (e: React.MouseEvent) => {
      e.preventDefault()
      action()
    },
    className: `${TOOLBAR_BTN} ${active ? ACTIVE : ''} ${disabled ? 'opacity-30 pointer-events-none' : ''}`,
  })

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
    >
      {/* 工具栏 */}
      <div
        className="flex flex-wrap gap-0.5 overflow-x-auto border-b px-2 py-1.5"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
      >
        {/* 标题 */}
        <button
          {...b(
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            editor.isActive('heading', { level: 1 })
          )}
          title="标题1"
        >
          H1
        </button>
        <button
          {...b(
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            editor.isActive('heading', { level: 2 })
          )}
          title="标题2"
        >
          H2
        </button>
        <button
          {...b(
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            editor.isActive('heading', { level: 3 })
          )}
          title="标题3"
        >
          H3
        </button>
        <span className="mx-0.5 w-px self-stretch" style={{ background: 'var(--border)' }} />
        {/* 格式 */}
        <button {...b(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))} title="粗体">
          <strong>B</strong>
        </button>
        <button {...b(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))} title="斜体">
          <em>I</em>
        </button>
        <button
          {...b(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
          title="下划线"
        >
          <u>U</u>
        </button>
        <button {...b(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))} title="删除线">
          <s>S</s>
        </button>
        <button {...b(() => editor.chain().focus().toggleCode().run(), editor.isActive('code'))} title="行内代码">
          {'<>'}
        </button>
        <span className="mx-0.5 w-px self-stretch" style={{ background: 'var(--border)' }} />
        {/* 列表 */}
        <button
          {...b(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
          title="无序列表"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="2" fill="currentColor" />
            <circle cx="4" cy="12" r="2" fill="currentColor" />
            <circle cx="4" cy="18" r="2" fill="currentColor" />
          </svg>
        </button>
        <button
          {...b(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          title="有序列表"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10H6" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-2-2-2" />
          </svg>
        </button>
        <button
          {...b(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
          title="引用"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
          </svg>
        </button>
        <button
          {...b(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
          title="代码块"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <span className="mx-0.5 w-px self-stretch" style={{ background: 'var(--border)' }} />
        {/* 链接 & 图片 & 引用卡片 */}
        <button {...b(setLink, editor.isActive('link'))} title="链接">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <button
          className={TOOLBAR_BTN}
          title="插入外部引用卡片"
          onClick={(e) => {
            e.preventDefault()
            insertQuoteUrl()
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          className={`${TOOLBAR_BTN} ${quotePickerOpen ? ACTIVE : ''}`}
          title="引用站内帖子"
          onClick={(e) => {
            e.preventDefault()
            setQuotePickerOpen((v) => !v)
            setQuotePickerQuery('')
            setQuotePickerResults([])
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
        <button
          className={TOOLBAR_BTN}
          title="插入图片"
          onClick={(e) => {
            e.preventDefault()
            fileInputRef.current?.click()
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <span className="mx-0.5 w-px self-stretch" style={{ background: 'var(--border)' }} />
        {/* 对齐 */}
        <button
          {...b(() => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}
          title="左对齐"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="21" y1="6" x2="3" y2="6" />
            <line x1="15" y1="12" x2="3" y2="12" />
            <line x1="17" y1="18" x2="3" y2="18" />
          </svg>
        </button>
        <button
          {...b(() => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }))}
          title="居中"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="21" y1="6" x2="3" y2="6" />
            <line x1="18" y1="12" x2="6" y2="12" />
            <line x1="21" y1="18" x2="3" y2="18" />
          </svg>
        </button>
        <span className="flex-1" />
        {/* 撤销/重做 */}
        <button {...b(() => editor.chain().focus().undo().run(), false, !editor.can().undo())} title="撤销">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        <button {...b(() => editor.chain().focus().redo().run(), false, !editor.can().redo())} title="重做">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </button>
      </div>

      {/* 气泡菜单（选中文字时弹出） */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div
          className="flex gap-0.5 rounded-xl px-1 py-1 shadow-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <button {...b(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))} title="粗体">
            <strong>B</strong>
          </button>
          <button {...b(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))} title="斜体">
            <em>I</em>
          </button>
          <button
            {...b(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            title="下划线"
          >
            <u>U</u>
          </button>
          <button {...b(setLink, editor.isActive('link'))} title="链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        </div>
      </BubbleMenu>

      {/* QuotePost 搜索面板 */}
      {quotePickerOpen && (
        <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: 'var(--accent)', flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="搜索站内帖子，按标题或内容..."
              value={quotePickerQuery}
              onChange={(e) => setQuotePickerQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={() => setQuotePickerOpen(false)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
              style={{ color: 'var(--text-secondary)' }}
            >
              关闭
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {quotePickerLoading && (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                搜索中...
              </div>
            )}
            {!quotePickerLoading && !quotePickerQuery.trim() && (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                输入关键词搜索帖子
              </div>
            )}
            {!quotePickerLoading && quotePickerQuery.trim() && quotePickerResults.length === 0 && (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                未找到相关帖子
              </div>
            )}
            {quotePickerResults.map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => insertQuotePost(r.slug)}
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.title}
                </div>
                {r.excerpt && (
                  <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {r.excerpt}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 编辑区 */}
      <div
        className="px-4"
        style={{ color: 'var(--text-primary)' }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'))
          if (files.length > 0) {
            e.preventDefault()
            files.forEach((f) => handleImageFile(f))
          }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'))
          if (files.length > 0) {
            e.preventDefault()
            files.forEach((f) => handleImageFile(f))
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 隐藏文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          Array.from(e.target.files || []).forEach((f) => handleImageFile(f))
          e.target.value = ''
        }}
      />
    </div>
  )
}
