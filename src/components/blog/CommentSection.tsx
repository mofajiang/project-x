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
    <div className="flex gap-3 min-w-0 overflow-hidden">
      <Avatar name={session?.username || (guestName || '?')} url={null} size={36} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {!session && (
          <div className="flex flex-col sm:flex-row gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              placeholder="昵称（必填）"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              maxLength={20}
              className="w-full sm:flex-1 bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)', minWidth: 0 }}
            />
            <div className="hidden sm:block" style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />
            <input
              type="email"
              placeholder="邮箱（选填，回复提醒）"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="w-full sm:flex-1 bg-transparent outline-none text-sm py-1"
              style={{ color: 'var(--text-primary)', minWidth: 0 }}
            />
          </div>
        )}

        {session && (
          <div className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            以 <span style={{ color: 'var(--accent)' }}>@{session.username}</span> 身份回复
          </div>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder || '说点什么...'}
          rows={2}
          autoFocus
          className="w-full bg-transparent resize-none outline-none text-sm"
          style={{ color: 'var(--text-primary)' }}
        />

        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: text.length > 1800 ? '#f4212e' : 'var(--text-secondary)' }}>{text.length}/2000</span>
          <div className="flex gap-2">
            {onCancel && (
              <button onClick={onCancel} className="px-3 py-1 rounded-full text-sm" style={{ color: 'var(--text-secondary)' }}>取消</button>
            )}
            <button
              onClick={submit}
              disabled={loading || !text.trim()}
              className="px-4 py-1 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? '提交中...' : parentId ? '回复' : '发布'}
            </button>
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
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 36 }}>
        <Avatar name={name} url={avatar} size={36} />
        {(comment.replies.length > 0 || replying) && (
          <div className="flex-1 w-0.5 mt-1" style={{ background: 'var(--border)', minHeight: 16 }} />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
          {!comment.author && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>访客</span>
          )}
          {showCommentIp && comment.ip && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.08)', color: 'var(--accent)' }} title={comment.ip}>
              IP {comment.ip}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>· {relativeTime(comment.createdAt)}</span>
        </div>

        <p className="text-sm mb-2" style={{ color: 'var(--text-primary)', lineHeight: '1.65' }}>{comment.content}</p>

        {depth < 2 && (
          <button
            onClick={() => setReplying(v => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
            style={{ color: replying ? 'var(--accent)' : 'var(--text-secondary)', background: replying ? 'rgba(29,155,240,0.08)' : 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            回复
          </button>
        )}

        {replying && (
          <div className="mt-3 p-2 sm:p-3 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
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
          <div className="mt-3 space-y-0 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
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
    <section className="px-4 py-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>评论 {comments.length}</h3>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>X 风格</span>
      </div>

      <div className="mb-5 p-4 rounded-3xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <CommentInput session={session} postId={postId} placeholder="说点什么..." onDone={() => {}} />
      </div>

      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>暂无评论，来说点什么吧</p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {comments.map(comment => (
            <div key={comment.id} className="pt-4">
              <CommentItem comment={comment} postId={postId} session={session} showCommentIp={showCommentIp} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
