import { headers } from 'next/headers'

export default async function UnlicensedPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>
}) {
  const sp = await searchParams
  const domain = sp.host || ''

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000', color: '#fff' }}>
      <div className="max-w-md w-full text-center flex flex-col gap-6">
        <div className="text-6xl">🔒</div>
        <div>
          <h1 className="text-2xl font-bold mb-2">未授权使用</h1>
          <p className="text-sm" style={{ color: '#8899A6' }}>
            当前域名未获得使用授权。<br />
            如需授权，请联系主题作者。
          </p>
        </div>
        <div className="rounded-2xl p-4 text-left text-sm flex flex-col gap-2" style={{ background: '#16181C', border: '1px solid #2F3336' }}>
          {domain && (
            <p className="font-mono" style={{ color: '#8899A6' }}>
              域名：<span style={{ color: '#F4212E' }}>{domain}</span>
            </p>
          )}
          <p className="font-mono" style={{ color: '#8899A6' }}>错误代码：LICENSE_DOMAIN_NOT_ALLOWED</p>
          <p className="font-mono" style={{ color: '#8899A6' }}>主题来源：<a href="https://github.com/mofajiang/project-x" className="underline" style={{ color: '#1D9BF0' }}>mofajiang/project-x</a></p>
        </div>
        <div className="flex gap-3 justify-center">
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-full font-bold text-sm"
            style={{ background: '#2F3336', color: '#fff' }}
          >
            重试
          </a>
          <a
            href="https://github.com/mofajiang/project-x"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-full font-bold text-sm"
            style={{ background: '#1D9BF0', color: '#fff' }}
          >
            申请授权 →
          </a>
        </div>
      </div>
    </div>
  )
}
