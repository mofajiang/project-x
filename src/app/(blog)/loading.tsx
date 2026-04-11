import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton'

export default function Loading() {
  return (
    <div>
      {/* Tabs 骨架：保持 sticky 结构，避免 layout shift */}
      <div
        className="sticky top-14 z-10 flex backdrop-blur-md md:top-0"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        {['推荐', '热议'].map((label) => (
          <div
            key={label}
            className="flex-1 py-3 text-center text-[15px] font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 卡片骨架占位 */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
