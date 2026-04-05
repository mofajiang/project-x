import { getSiteConfig } from '@/lib/config'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const config = await getSiteConfig()
  return (
    <div>
      <div className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md" style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>关于</h1>
      </div>
      <div className="px-4 py-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-700 mb-4 flex items-center justify-center text-4xl">✕</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{config.siteName}</h2>
          {config.siteDesc && (
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <MarkdownRenderer content={config.siteDesc} />
            </div>
          )}
        </div>
        <div className="flex justify-center gap-4">
          {config.socialX && (
            <a href={`https://x.com/${config.socialX}`} target="_blank"
              className="px-5 py-2 rounded-full text-sm font-bold transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              𝕏 @{config.socialX}
            </a>
          )}
          {config.socialGithub && (
            <a href={`https://github.com/${config.socialGithub}`} target="_blank"
              className="px-5 py-2 rounded-full text-sm font-bold transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              GitHub
            </a>
          )}
          {config.socialEmail && (
            <a href={`mailto:${config.socialEmail}`}
              className="px-5 py-2 rounded-full text-sm font-bold transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              邮件联系
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
