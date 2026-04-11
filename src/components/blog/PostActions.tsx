'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function PostActions({ postId, likes, commentCount }: { postId: string; likes: number; commentCount: number }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(likes)

  const jumpToComments = () => {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleLike = async () => {
    if (liked) return
    setLiked(true)
    setLikeCount((c) => c + 1)
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
  }

  const handleRepost = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('链接已复制，可直接引用转发')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href })
        return
      } catch {
        // ignore canceled share
      }
    }
    await navigator.clipboard.writeText(window.location.href)
    toast.success('链接已复制')
  }

  const actionClass =
    'group flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[13px] transition-colors'

  return (
    <div className="-mx-4 border-b px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-1">
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
        <button type="button" onClick={handleRepost} className={actionClass} style={{ color: 'var(--text-secondary)' }}>
          <span className="rounded-full p-2 transition-colors group-hover:bg-emerald-500/10 group-hover:text-emerald-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 2 21 6l-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 22 3 18l4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </span>
          <span className="min-w-[2ch] text-left group-hover:text-emerald-500">转发</span>
        </button>
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
