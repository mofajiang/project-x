'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center p-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>出错了</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-full text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          重试
        </button>
      </div>
    </div>
  )
}
