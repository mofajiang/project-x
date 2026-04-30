import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg)' }}>
      <h1 className="text-8xl font-black mb-4" style={{ color: 'var(--text-primary)' }}>404</h1>
      <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>页面不存在</p>
      <Link href="/"
        className="px-6 py-3 rounded-full font-bold text-white"
        style={{ background: 'var(--accent)' }}>返回首页</Link>
    </div>
  )
}
