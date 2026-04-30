'use client'
import { useEffect } from 'react'

export default function BlogError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Blog Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4" style={{ color: 'var(--text-primary)' }}>
      <div className="text-6xl mb-4">😵</div>
      <h2 className="text-xl font-bold mb-2">页面出现错误</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{error.message || '发生了未知错误'}</p>
      <button
        onClick={reset}
        className="px-6 py-2 rounded-full text-sm font-bold text-white"
        style={{ background: 'var(--accent)' }}
      >
        重试
      </button>
    </div>
  )
}
