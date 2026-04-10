'use client'
import { useEffect, useState } from 'react'
import { FriendFeedCard } from './FriendFeedCard'
import type { FeedItem } from '@/lib/rss-fetcher'

export function FriendCircleList() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/friends-feed')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-5 animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
              <div className="h-3 w-24 animate-pulse rounded" style={{ background: 'var(--bg-hover)' }} />
            </div>
            <div className="mb-1 h-4 w-3/4 animate-pulse rounded" style={{ background: 'var(--bg-hover)' }} />
            <div className="h-3 w-full animate-pulse rounded" style={{ background: 'var(--bg-hover)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error || items.length === 0) {
    return (
      <div className="py-20 text-center" style={{ color: 'var(--text-secondary)' }}>
        {error ? '加载失败，请稍后刷新重试。' : '暂无朋友圈内容，请先在后台为友链添加 RSS 地址，并确保朋友功能已启用。'}
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {items.map((item, i) => (
        <FriendFeedCard key={`${item.link}-${i}`} item={item} />
      ))}
    </div>
  )
}
