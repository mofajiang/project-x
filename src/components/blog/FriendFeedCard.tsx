'use client'
import { relativeTime } from '@/lib/utils'
import type { FeedItem } from '@/lib/rss-fetcher'

interface FriendFeedCardProps {
  item: FeedItem
}

export function FriendFeedCard({ item }: FriendFeedCardProps) {
  const timeStr = relativeTime(new Date(item.publishedAt))

  return (
    <div className="px-4 py-4 transition-colors hover:bg-[var(--bg-hover)]" style={{ borderColor: 'var(--border)' }}>
      {/* 来源信息 */}
      <div className="mb-2 flex items-center gap-2">
        {item.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.favicon}
            alt={item.blogName}
            className="h-5 w-5 rounded-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {item.blogName.charAt(0).toUpperCase()}
          </div>
        )}
        <a
          href={item.blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {item.blogName}
        </a>
        <span className="text-xs" style={{ color: 'var(--text-tertiary, var(--text-secondary))' }}>
          · {timeStr}
        </span>
      </div>

      {/* 标题 */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-1 block text-base font-semibold leading-snug hover:underline"
        style={{ color: 'var(--text-primary)' }}
      >
        {item.title}
      </a>

      {/* 摘要 */}
      {item.summary && (
        <p className="line-clamp-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {item.summary}
        </p>
      )}
    </div>
  )
}
