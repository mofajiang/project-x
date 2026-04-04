'use client'
import { useState } from 'react'
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
  ip?: string | null
  replies: Comment[]
}

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: size * 0.4, color: 'var(--accent)' }}
    >
      {url
        ? <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" />
        : name.charAt(0).toUpperCase()}
    </div>
  )
}

function ComposerIcon({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)] sm:h-7 sm:w-7"
      style={{ color: 'var(--accent)' }}
      aria-hidden="true"
      tabIndex={-1}
    >
      {children}
    </button>
  )
}

function MediaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m8 14 2.6-2.6a1.2 1.2 0 0 1 1.7 0L16 15" />
      <path d="m14.5 9.5.2-.2a1.2 1.2 0 0 1 1.7 0L21 14" />
      <circle cx="9" cy="8" r="1.4" />
    </svg>
  )
}

function GifIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M8 10a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h1" />
      <path d="M13 10v4" />
      <path d="M17 10h-2v4" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
    </svg>
  )
}

function EmojiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 14.5c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <path d="M12 13v3l2 1" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 9V5l-7 7 7 7v-4c7 0 11 2 11 7 0-8-4-13-11-13z" />
    </svg>
  )
}

function CommentInput({
  session, postId, parentId, placeholder, onDone, onCancel,
}: {
  session: JWTPayload | null
  postId: string
  parentId?: string
  placeholder?: string
  onDone: () => void
  onCancel?: () => void
}) {
  const [text, setText] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="flex gap-2 min-w-0 overflow-hidden sm:gap-2.5">
      <Avatar name={session?.username || (guestName || '?')} url={null} size={32} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {!session && (
          <div className="mb-2.5 grid gap-2 rounded-[20px] border px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:px-3.5 sm:py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--comment-surface-soft)' }}>
            <input
              type="text"
              placeholder="昵称（必填）"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              maxLength={20}
              className="w-full bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)', minWidth: 0 }}
            />
            <div className="hidden sm:block" style={{ width: '1px', background: 'var(--border)', flexShrink: 0, minHeight: 18 }} />
            <input
              type="email"
              placeholder="邮箱（选填，回复提醒）"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)', minWidth: 0 }}
            />
          </div>
        )}

        <div className="rounded-[22px] border px-3 py-3 shadow-[var(--comment-shadow)] sm:rounded-[24px] sm:px-4 sm:py-4" style={{ background: 'var(--comment-surface)', borderColor: 'var(--border)' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={placeholder || '有什么新鲜事？'}
            rows={3}
            autoFocus
            className="w-full resize-none bg-transparent text-[13px] outline-none sm:text-[14px]"
            style={{ color: 'var(--text-primary)', minHeight: 84, lineHeight: 1.55 }}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 sm:mt-3.5 sm:gap-2.5 sm:pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-px sm:gap-0.5">
              <ComposerIcon><MediaIcon /></ComposerIcon>
              <ComposerIcon><GifIcon /></ComposerIcon>
              <ComposerIcon><ChartIcon /></ComposerIcon>
              <ComposerIcon><EmojiIcon /></ComposerIcon>
              <ComposerIcon><ScheduleIcon /></ComposerIcon>
              <ComposerIcon><LocationIcon /></ComposerIcon>
            </div>

            <div className="flex items-center gap-1 sm:gap-2.5">
              <span className="text-[11px] tabular-nums sm:text-xs" style={{ color: text.length > 1800 ? '#f4212e' : 'var(--text-secondary)' }}>{text.length}/2000</span>
              {onCancel && (
                <button onClick={onCancel} className="rounded-full px-2 py-1.5 text-[11px] sm:px-3 sm:text-sm" style={{ color: 'var(--text-secondary)' }}>取消</button>
              )}
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
          </div>
        </div>
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
  const avatar = comment.author?.avatar || null

  return (
    <div className="flex gap-2 rounded-[22px] border px-3 py-3 sm:gap-2.5 sm:rounded-[24px] sm:px-4 sm:py-4" style={{ background: 'var(--comment-surface-soft)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        <Avatar name={name} url={avatar} size={32} />
        {(comment.replies.length > 0 || replying) && (
          <div className="flex-1 w-px mt-1" style={{ background: 'var(--comment-thread-line)', minHeight: 12 }} />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-0.5 sm:pb-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[12px] font-bold sm:text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
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

        <p className="mb-2.5 text-[13px] sm:text-[14px]" style={{ color: 'var(--text-primary)', lineHeight: '1.58' }}>{comment.content}</p>

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
          <div className="mt-3 overflow-hidden rounded-[22px] border p-3 sm:mt-4 sm:rounded-[24px] sm:p-4" style={{ background: 'var(--comment-surface)', borderColor: 'var(--border)' }}>
            <CommentInput
              session={session}
              postId={postId}
              parentId={comment.id}
              placeholder={`回复 @${name}...`}
              onDone={() => setReplying(false)}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-2.5 border-l pl-2.5 sm:pl-3" style={{ borderColor: 'var(--comment-thread-line)' }}>
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
    <section className="px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 rounded-[24px] border p-3 sm:mb-5 sm:rounded-[26px] sm:p-4" style={{ background: 'var(--comment-surface-strong)', borderColor: 'var(--border)' }}>
        <CommentInput session={session} postId={postId} placeholder="说点什么..." onDone={() => {}} />
      </div>

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
