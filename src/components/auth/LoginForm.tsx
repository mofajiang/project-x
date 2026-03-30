'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export function LoginForm({ loginPath }: { loginPath?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, ...(loginPath ? { loginPath } : {}) }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      toast.success('登录成功')
      window.location.href = '/admin'
    } else {
      toast.error(data.error || '登录失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* 卡片容器 */}
        <div className="rounded-2xl px-8 py-10" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent)' }}>
            <span className="text-2xl font-black text-white">✕</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>欢迎回来</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>登录以管理你的博客</p>
        </div>

        <form onSubmit={login} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              placeholder="用户名或邮箱"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all pr-12"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <button type="button" onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--text-secondary)' }}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-full font-bold text-white text-sm transition-all disabled:opacity-50 mt-2"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}
