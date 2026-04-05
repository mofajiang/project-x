'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { JWTPayload } from '@/lib/auth'

interface Comment {
  id: string
  content: string
  createdAt: Date
  author: { username: string; avatar: string | null } | null
  guestName: string | null
  guestWebsite: string | null
  ip?: string | null
  replies: Comment[]
}

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: size * 0.4, color: 'var(--accent)' }}
    >
      {url && !err
        ? <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" onError={() => setErr(true)} />
        : name.charAt(0).toUpperCase()}
    </div>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 9V5l-7 7 7 7v-4c7 0 11 2 11 7 0-8-4-13-11-13z" />
    </svg>
  )
}

const EMOJI_LIST = [
  '😀','😂','😊','😍','🥹','😅','😎','🤣',
  '❤️','🧡','💛','💚','💙','💜','🖤','💕',
  '🔥','💯','✅','🎉','🌟','✨','🌈','🍀',
  '👍','👏','🙏','💪','🤝','👋','✌️','🫶',
  '😢','😔','😤','😠','🤯','😱','🥺','🤗',
  '🎵','🎮','📚','💻','🍕','☕','🌙','🌸',
]

function CommentInput({
  session, postId, parentId, placeholder, onDone, onCancel, defaultExpanded,
}: {
  session: JWTPayload | null
  postId: string
  parentId?: string
  placeholder?: string
  onDone: () => void
  onCancel?: () => void
  defaultExpanded?: boolean
}) {
  const [text, setText] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestWebsite, setGuestWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showEmoji) return
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    setShowEmoji(false)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    })
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const submit = async () => {
    const content = text.trim()
    if (!content) return
    if (!session && !guestName.trim()) {
      toast.error('请填写昵称')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          content,
          parentId,
          guestName: guestName.trim() || undefined,
          guestEmail: guestEmail.trim() || undefined,
          guestWebsite: guestWebsite.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('评论已提交，等待审核')
        setText('')
        onDone()
      } else {
        toast.error(data.error || '提交失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2.5 min-w-0 overflow-hidden sm:gap-3">
      <div className="flex-shrink-0 pt-2">
        <Avatar name={session?.username || (guestName || '?')} url={null} size={36} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden pt-1.5">
        {!session && expanded && (
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="text"
              placeholder="昵称（必填）"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              maxLength={20}
              className="w-full min-w-0 bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)' }}
            />
            <input
              type="email"
              placeholder="邮箱（选填）"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="w-full min-w-0 bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)' }}
            />
            <input
              type="url"
              placeholder="网站（选填）"
              value={guestWebsite}
              onChange={e => setGuestWebsite(e.target.value)}
              className="w-full min-w-0 bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onFocus={() => setExpanded(true)}
          placeholder={placeholder || '有什么新鲜事？'}
          rows={1}
          className="w-full resize-none bg-transparent px-0 text-[15px] outline-none"
          style={{ color: 'var(--text-primary)', lineHeight: 1.5, overflow: 'hidden' }}
        />

        {expanded && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  title="插入表情"
                  className="flex items-center justify-center w-7 h-7 rounded-full text-base leading-none transition-colors"
                  style={{ color: showEmoji ? 'var(--accent)' : 'var(--text-secondary)', background: showEmoji ? 'rgba(29,155,240,0.1)' : 'transparent' }}
                >
                  😊
                </button>
                {showEmoji && (
                  <div
                    className="absolute bottom-9 left-0 z-50 rounded-2xl p-2 shadow-xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', width: 272 }}
                  >
                    <div className="grid grid-cols-8 gap-0.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {EMOJI_LIST.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="flex items-center justify-center rounded-lg p-1.5 text-xl leading-none transition-colors hover:scale-110 flex-shrink-0"
                          style={{ background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[11px] tabular-nums sm:text-xs" style={{ color: text.length > 1800 ? '#f4212e' : 'var(--text-secondary)' }}>{text.length}/2000</span>
            </div>
            <button
              onClick={submit}
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
              style={{ background: 'var(--accent)' }}
            >
              <ReplyIcon />
              {loading ? '提交中...' : parentId ? '回复' : '发布'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment, postId, session, depth = 0, showCommentIp = false }: {
  comment: Comment
  postId: string
  session: JWTPayload | null
  depth?: number
  showCommentIp?: boolean
}) {
  const [replying, setReplying] = useState(false)
  const name = comment.author?.username || comment.guestName || '匿名'
  const faviconUrl = !comment.author && comment.guestWebsite
    ? (() => { try { const host = new URL(comment.guestWebsite).hostname; return `https://www.google.com/s2/favicons?domain=${host}&sz=64` } catch { return null } })()
    : null
  const avatar = comment.author?.avatar || faviconUrl

  return (
    <div className="flex gap-2 py-2.5 sm:gap-2.5 sm:py-3">
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        <Avatar name={name} url={avatar} size={32} />
        {(comment.replies.length > 0 || replying) && (
          <div className="flex-1 w-px mt-1" style={{ background: 'var(--comment-thread-line)', minHeight: 12 }} />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-0.5 sm:pb-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[12px] font-bold sm:text-sm" style={{ color: 'var(--text-primary)' }}>
            {comment.guestWebsite ? (
              <a href={comment.guestWebsite} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{name}</a>
            ) : name}
          </span>
          {!comment.author && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>访客</span>
          )}
          {showCommentIp && comment.ip && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--accent)' }} title={comment.ip}>
              IP {comment.ip}
            </span>
          )}
          <span className="text-[10px] leading-4 sm:text-xs" style={{ color: 'var(--text-secondary)' }}>· {relativeTime(comment.createdAt)}</span>
        </div>

        <p className="mb-2 text-[13px] sm:text-[14px]" style={{ color: 'var(--text-primary)', lineHeight: '1.55' }}>{comment.content}</p>

        {depth < 2 && (
          <button
            onClick={() => setReplying(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] transition-colors sm:px-3 sm:text-xs"
            style={{ color: replying ? 'var(--accent)' : 'var(--text-secondary)', background: replying ? 'rgba(29,155,240,0.10)' : 'var(--bg-hover)' }}
          >
            <ReplyIcon />
            回复
          </button>
        )}

        {replying && (
          <div className="mt-3 sm:mt-4">
            <CommentInput
              session={session}
              postId={postId}
              parentId={comment.id}
              placeholder={`回复 @${name}...`}
              onDone={() => setReplying(false)}
              onCancel={() => setReplying(false)}
              defaultExpanded
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-2.5 space-y-2 border-l pl-2.5 sm:mt-3 sm:pl-3" style={{ borderColor: 'var(--comment-thread-line)' }}>
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                session={session}
                depth={depth + 1}
                showCommentIp={showCommentIp}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentSection({
  postId,
  comments: initial,
  session,
  showCommentIp = false,
}: {
  postId: string
  comments: Comment[]
  session: JWTPayload | null
  showCommentIp?: boolean
}) {
  const [comments] = useState(() => {
    const normalize = (c: Comment): Comment => ({ ...c, replies: (c.replies ?? []).map(normalize) })
    return initial.map(normalize)
  })

  return (
    <section className="px-4 pt-2 pb-4 sm:px-5 sm:pt-2 sm:pb-5">
      <div className="py-3 sm:py-4">
        <CommentInput session={session} postId={postId} placeholder="说点什么..." onDone={() => {}} />
      </div>

      <div aria-hidden="true" className="-mx-4 sm:-mx-5 h-px mb-3 sm:mb-4" style={{ background: 'var(--border)' }} />

      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>暂无评论，来说点什么吧</p>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {comments.map(comment => (
            <div key={comment.id}>
              <CommentItem comment={comment} postId={postId} session={session} showCommentIp={showCommentIp} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
