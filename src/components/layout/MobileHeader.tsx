'use client'
import { useRouter } from 'next/navigation'
import type { JWTPayload } from '@/lib/auth'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface Props {
  siteName: string
  session?: JWTPayload | null
  avatar?: string | null
  displayName?: string
  handle?: string
}

export function MobileHeader({ siteName, session, avatar, displayName, handle }: Props) {
  const router = useRouter()
  return (
    <header
      className="md:hidden flex items-center justify-between px-4 h-14 sticky top-0 z-40"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
    >
      {/* 左侧：头像（有登录）或占位 */}
      <div className="w-8 h-8">
        {session && (
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {avatar
              ? <img src={avatar} alt={handle || session.username} className="w-full h-full object-cover" />
              : (displayName || handle || session.username)[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* 中间：X Logo */}
      <button
        onClick={() => router.push('/')}
        className="text-2xl font-black select-none"
        style={{ color: 'var(--text-primary)' }}
        title={siteName}
      >
        ✕
      </button>

      {/* 右侧：主题切换 */}
      <ThemeToggle className="w-8 h-8" />
    </header>
  )
}
