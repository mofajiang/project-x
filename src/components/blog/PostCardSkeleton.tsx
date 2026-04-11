/**
 * X-style skeleton placeholder for PostCard.
 * Uses Tailwind animate-pulse + CSS variables so it respects dark/light/sepia themes.
 */
export function PostCardSkeleton() {
  return (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex gap-3">
        {/* 头像骨架 */}
        <div className="flex-shrink-0 pt-0.5">
          <div className="h-10 w-10 animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
        </div>

        {/* 内容骨架 */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {/* 作者行：名字 + @handle + 时间 */}
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-24 animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
            <div className="h-3 w-16 animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
            <div className="h-3 w-10 animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
          </div>

          {/* 正文占位：3 行递减宽度 */}
          <div className="h-4 w-full animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-4 w-[88%] animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-4 w-[70%] animate-pulse rounded-full" style={{ background: 'var(--bg-hover)' }} />

          {/* 操作栏：4 个小块 */}
          <div className="flex items-center justify-between pt-1">
            {[8, 8, 8, 6].map((w, i) => (
              <div
                key={i}
                className={`h-3 w-${w} animate-pulse rounded-full`}
                style={{ background: 'var(--bg-hover)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
