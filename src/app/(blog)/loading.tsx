export default function Loading() {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-5">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
            <div className="h-3.5 w-28 rounded-full animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
          </div>
          <div className="h-5 w-2/3 rounded animate-pulse mb-2" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-full rounded animate-pulse mb-1.5" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-5/6 rounded animate-pulse mb-1.5" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-4/5 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
        </div>
      ))}
    </div>
  )
}
