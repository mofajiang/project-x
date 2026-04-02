'use client'
import Link from 'next/link'

const tabs = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门' },
]

export function FeedTabs({ active }: { active: string }) {
  return (
    <div
      className="sticky top-14 md:top-0 z-10 flex backdrop-blur-md"
      style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
    >
      {tabs.map(tab => (
        <Link
          key={tab.key}
          href={`/?tab=${tab.key}`}
          prefetch={true}
          className="flex-1 py-[14px] text-[15px] font-semibold relative transition-colors text-center"
          style={{ color: active === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {tab.label}
          {active === tab.key && (
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
              style={{ background: 'var(--accent)', height: '4px', width: '56px' }}
            />
          )}
        </Link>
      ))}
    </div>
  )
}
