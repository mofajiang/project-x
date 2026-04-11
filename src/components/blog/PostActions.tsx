'use client'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

export function PostActions({
  postId,
  postSlug,
  likes,
  commentCount,
  reposts: initialReposts = 0,
  isLoggedIn = false,
}: {
  postId: string
  postSlug: string
  likes: number
  commentCount: number
  reposts?: number
  isLoggedIn?: boolean
}) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(likes)
  const [repostCount, setRepostCount] = useState(initialReposts)
  const [repostOpen, setRepostOpen] = useState(false)
  const [reposting, setReposting] = useState(false)
  const repostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!repostOpen) return
    const handler = (e: PointerEvent) => {
      if (!repostRef.current?.contains(e.target as Node)) setRepostOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [repostOpen])

  const jumpToComments = () => {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleLike = async () => {
    if (liked) return
    setLiked(true)
    setLikeCount((c) => c + 1)
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
  }

  const handleRepostAction = async () => {
    setRepostOpen(false)
    if (!isLoggedIn) {
      toast.error('请先登录后转发')
      return
    }
    setReposting(true)
    const res = await fetch(`/api/posts/${postId}/repost`, { method: 'POST' })
    setReposting(false)
    if (res.ok) {
      setRepostCount((c) => c + 1)
      toast.success('转发成功')
    } else if (res.status === 401) {
      toast.error('请先登录后转发')
    } else {
      toast.error('转发失败')
    }
  }

  const handleQuote = () => {
    setRepostOpen(false)
    if (!isLoggedIn) {
      toast.error('请先登录')
      return
    }
    window.dispatchEvent(new CustomEvent('open-compose', { detail: { quoteSlug: postSlug } }))
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href })
        return
      } catch {}
    }
    await navigator.clipboard.writeText(window.location.href)
    toast.success('链接已复制')
  }

  const actionClass =
    'group flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[13px] transition-colors'

  return (
    <div className="-mx-4 border-b px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-1">
        {/* 评论 */}
        <button
          type="button"
          onClick={jumpToComments}
          className={actionClass}
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="min-w-[2ch] text-left group-hover:text-sky-500">{commentCount}</span>
        </button>

        {/* 转发（气泡） */}
        <div className="relative flex min-w-0 flex-1 justify-center" ref={repostRef}>
          <button
            type="button"
            onClick={() => setRepostOpen((o) => !o)}
            disabled={reposting}
            className={actionClass}
            style={{ color: repostOpen ? '#00BA7C' : 'var(--text-secondary)' }}
          >
            <span
              className={`rounded-full p-2 transition-colors ${repostOpen ? 'bg-emerald-500/10 text-emerald-500' : 'group-hover:bg-emerald-500/10 group-hover:text-emerald-500'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M17 2 21 6l-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 22 3 18l4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
            <span
              className={`min-w-[2ch] text-left ${repostOpen ? 'text-emerald-500' : 'group-hover:text-emerald-500'}`}
            >
              {repostCount > 0 ? repostCount : '转发'}
            </span>
          </button>
          {repostOpen && (
            <div
              className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 overflow-hidden rounded-xl shadow-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', minWidth: 160 }}
            >
              <button
                onClick={handleRepostAction}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                style={{ color: 'var(--text-primary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M17 2 21 6l-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 22 3 18l4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                转发
              </button>
              <button
                onClick={handleQuote}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold transition-colors hover:bg-sky-500/10 hover:text-sky-500"
                style={{ color: 'var(--text-primary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                引用发帖
              </button>
            </div>
          )}
        </div>

        {/* 点赞 */}
        <button
          type="button"
          onClick={handleLike}
          className={actionClass}
          style={{ color: liked ? '#F91880' : 'var(--text-secondary)' }}
        >
          <span
            className={`rounded-full p-2 transition-all ${liked ? 'scale-110 bg-pink-500/10 text-pink-500' : 'group-hover:bg-pink-500/10 group-hover:text-pink-500'}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          <span className="min-w-[2ch] text-left">{likeCount}</span>
        </button>

        {/* 分享 */}
        <button type="button" onClick={handleShare} className={actionClass} style={{ color: 'var(--text-secondary)' }}>
          <span className="rounded-full p-2 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M12 16V3" />
              <path d="m7 8 5-5 5 5" />
            </svg>
          </span>
          <span className="min-w-[2ch] text-left group-hover:text-sky-500">分享</span>
        </button>
      </div>
    </div>
  )
}
