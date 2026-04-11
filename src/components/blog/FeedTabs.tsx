'use client'
import Link from 'next/link'

const BASE_TABS = [
  { key: 'latest', label: '推荐' },
  { key: 'hot', label: '热议' },
]

export function FeedTabs({ active, showFriendCircle = false }: { active: string; showFriendCircle?: boolean }) {
  const tabs = showFriendCircle ? [...BASE_TABS, { key: 'friends', label: '关注中' }] : BASE_TABS
  return (
    <div
      className="sticky top-14 z-10 backdrop-blur-md md:top-0"
      style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center px-4 pt-2">
        <span className="text-[18px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
          主页
        </span>
      </div>
      <div className="mt-1 flex">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/?tab=${tab.key}`}
            prefetch={true}
            className="relative flex-1 py-3 text-center text-[15px] font-semibold transition-colors"
            style={{ color: active === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {tab.label}
            {active === tab.key && (
              <span
                className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
