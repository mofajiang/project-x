'use client'
import { useEffect } from 'react'

export default function PostsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>加载文章列表失败</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{error.message}</p>
        <button onClick={reset} className="px-4 py-2 rounded-full text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>重试</button>
      </div>
    </div>
  )
}
