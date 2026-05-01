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
  guestWebsite: string | null
  ip?: string | null
  replies: Comment[]
}

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        fontSize: size * 0.4,
        color: 'var(--accent)',
      }}
    >
      {url && !err ? (
        <Image
          src={url}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

function ReplyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 9V5l-7 7 7 7v-4c7 0 11 2 11 7 0-8-4-13-11-13z" />
    </svg>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CommentInput({
  session,
  postId,
  parentId,
  placeholder,
  onDone,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCancel,
  defaultExpanded,
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
    <div className="flex min-w-0 gap-2.5 overflow-hidden sm:gap-3">
      <div className="flex-shrink-0 pt-2">
        <Avatar name={session?.username || guestName || '?'} url={null} size={36} />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden pt-1.5">
        {!session && expanded && (
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="text"
              placeholder="昵称（必填）"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={20}
              className="w-full min-w-0 border-b bg-transparent py-2 text-sm outline-none"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
            <input
              type="email"
              placeholder="邮箱（选填）"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full min-w-0 border-b bg-transparent py-2 text-sm outline-none"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
            <input
              type="url"
              placeholder="网站（选填）"
              value={guestWebsite}
              onChange={(e) => setGuestWebsite(e.target.value)}
              className="w-full min-w-0 border-b bg-transparent py-2 text-sm outline-none"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            />
          </div>
        )}

        <textarea
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
            <span
              className="text-[11px] tabular-nums sm:text-xs"
              style={{ color: text.length > 1800 ? '#f4212e' : 'var(--text-secondary)' }}
            >
              {text.length}/2000
            </span>
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

function CommentItem({
  comment,
  postId,
  session,
  depth = 0,
  showCommentIp = false,
  replyToName,
}: {
  comment: Comment
  postId: string
  session: JWTPayload | null
  depth?: number
  showCommentIp?: boolean
  replyToName?: string
}) {
  const [replying, setReplying] = useState(false)
  const name = comment.author?.username || comment.guestName || '匿名'
  const faviconUrl =
    !comment.author && comment.guestWebsite
      ? (() => {
          try {
            const host = new URL(comment.guestWebsite).hostname
            return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
          } catch {
            return null
          }
        })()
      : null
  const avatar = comment.author?.avatar || faviconUrl

  return (
    <div className="flex gap-2.5 py-3 sm:gap-3 sm:py-4">
      <div className="flex flex-shrink-0 flex-col items-center" style={{ width: 36 }}>
        <Avatar name={name} url={avatar} size={36} />
        {(comment.replies.length > 0 || replying) && (
          <div className="mt-1 w-px flex-1" style={{ background: 'var(--border)', minHeight: 12 }} />
        )}
      </div>

      <div className="min-w-0 flex-1 pb-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0">
          <span className="text-[13px] font-bold sm:text-sm" style={{ color: 'var(--text-primary)' }}>
            {comment.guestWebsite ? (
              <a
                href={comment.guestWebsite}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
              >
                {name}
              </a>
            ) : (
              name
            )}
          </span>
          {!comment.author && (
            <span
              className="rounded px-1 py-0.5 text-[10px]"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              访客
            </span>
          )}
          {showCommentIp && comment.ip && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px]"
              style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--accent)' }}
              title={comment.ip}
            >
              IP {comment.ip}
            </span>
          )}
          <span className="text-[11px] leading-4" style={{ color: 'var(--text-secondary)' }}>
            · {relativeTime(comment.createdAt)}
          </span>
        </div>

        <p className="mb-2 text-[13px] leading-relaxed sm:text-sm" style={{ color: 'var(--text-primary)' }}>
          {replyToName && (
            <span className="mr-1 font-medium" style={{ color: 'var(--accent)' }}>
              @{replyToName}
            </span>
          )}
          {comment.content}
        </p>

        {depth < 2 && (
          <button
            onClick={() => setReplying((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
            style={{
              color: replying ? 'var(--accent)' : 'var(--text-secondary)',
              background: replying ? 'rgba(29,155,240,0.10)' : 'transparent',
            }}
          >
            <ReplyIcon />
            回复
          </button>
        )}

        {replying && (
          <div className="mt-3">
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
          <div className="mt-3 space-y-0.5">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                session={session}
                depth={depth + 1}
                showCommentIp={showCommentIp}
                replyToName={name}
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

  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)

  return (
    <section className="px-4 pb-6 pt-2 sm:px-5">
      <div
        className="-mx-4 flex items-center gap-3 px-4 py-3 sm:-mx-5 sm:px-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
            对话
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {totalCount > 0 ? `${totalCount} 条回复正在展开` : '还没有人加入这条对话'}
          </p>
        </div>
      </div>

      <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="mb-3 text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
          加入对话
        </div>
        <CommentInput session={session} postId={postId} placeholder="发表评论..." onDone={() => {}} />
      </div>

      {comments.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          还没有回复，成为第一个加入对话的人
        </p>
      ) : (
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          {comments.map((comment) => (
            <div key={comment.id} style={{ borderColor: 'var(--border)' }}>
              <CommentItem comment={comment} postId={postId} session={session} showCommentIp={showCommentIp} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
