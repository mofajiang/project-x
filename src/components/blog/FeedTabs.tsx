'use client'
import Link from 'next/link'

const BASE_TABS = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门' },
]

export function FeedTabs({ active, showFriendCircle = false }: { active: string; showFriendCircle?: boolean }) {
  const tabs = showFriendCircle ? [...BASE_TABS, { key: 'friends', label: '博友圈' }] : BASE_TABS
  return (
    <div
      className="sticky top-0 z-10 flex backdrop-blur-md"
      style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`/?tab=${tab.key}`}
          prefetch={true}
          className="relative flex-1 py-[14px] text-center text-[15px] font-semibold transition-colors"
          style={{ color: active === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {tab.label}
          {active === tab.key && (
            <span
              className="absolute bottom-0 left-4 right-4 rounded-full"
              style={{ background: 'var(--accent)', height: '4px' }}
            />
          )}
        </Link>
      ))}
    </div>
  )
}
