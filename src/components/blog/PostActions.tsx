'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function PostActions({ postId, likes, commentCount }: { postId: string; likes: number; commentCount: number }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(likes)

  const handleLike = async () => {
    if (liked) return
    setLiked(true)
    setLikeCount(c => c + 1)
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('链接已复制')
  }

  return (
    <div className="flex items-center justify-between pt-2 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <button className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-blue-500/10 hover:text-blue-400 text-sm"
        style={{ color: 'var(--text-secondary)' }}>
        💬 {commentCount}
      </button>
      <button
        onClick={handleLike}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm ${
          liked ? 'text-pink-500' : ''
        } hover:bg-pink-500/10 hover:text-pink-500`}
        style={{ color: liked ? '#F91880' : 'var(--text-secondary)' }}
      >
        <span className={liked ? 'scale-125 transition-transform' : ''}>❤️</span>
        {likeCount}
      </button>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-blue-500/10 hover:text-blue-400 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        ↗ 分享
      </button>
    </div>
  )
}
