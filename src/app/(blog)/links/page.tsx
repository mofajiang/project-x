import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: '友情链接',
  description: '友情链接列表，欢迎互换友链',
}

async function getApprovedLinks() {
  try {
    return await prisma.$queryRawUnsafe<Array<{
      id: string
      name: string
      url: string
      description: string | null
      favicon: string | null
    }>>(
      `SELECT id, name, url, description, favicon
       FROM FriendLink
       WHERE status = 'approved'
       ORDER BY COALESCE(sortOrder, 0) DESC,
                CASE
                  WHEN approvedAt IS NULL THEN 0
                  WHEN typeof(approvedAt) = 'integer' THEN approvedAt
                  ELSE CAST(strftime('%s', approvedAt) AS INTEGER) * 1000
                END DESC`
    )
  } catch {
    return []
  }
}

export default async function LinksPage() {
  const links = await getApprovedLinks()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto px-3 py-6 sm:px-4 sm:py-12">
        {/* 页面头部 */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            友情链接
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
            欢迎与我们互换友链，共同成长。
          </p>
        </div>

        {/* 申请表单卡片（上移） */}
        <div
          className="rounded-xl overflow-hidden border mb-8"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="px-6 py-7 text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              申请友情链接
            </h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              填写网站信息，审核后会加入友链列表。
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/links/submit"
                className="px-6 py-2.5 rounded-lg font-bold text-white transition-all hover:shadow-lg"
                style={{ background: 'var(--accent)' }}
              >
                立即申请
              </Link>
              <Link
                href="/"
                className="px-6 py-2.5 rounded-lg font-bold transition-all"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                }}
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>

        {/* 已通过的友链 */}
        {links.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
              已认可的友链
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {/* 头像 */}
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {link.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.favicon} alt={link.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span>{link.name[0]?.toUpperCase()}</span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate group-hover:underline text-[18px]" style={{ color: 'var(--text-primary)' }}>
                      {link.name}
                    </p>
                    {link.description && (
                      <p
                        className="text-xs truncate"
                        style={{ color: 'var(--text-secondary)' }}
                        title={link.description}
                      >
                        {link.description}
                      </p>
                    )}
                  </div>

                  {/* 外链图标 */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 须知 */}
        <div className="mt-12 p-8 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            📝 申请须知
          </h3>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>✓ 网站要求：</strong>{' '}
              网站需在线正常访问，内容积极向上
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>✓ 互链要求：</strong>{' '}
              您的网站应已添加本站友链，系统会自动检测
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>✓ 审核时间：</strong> AI 智能审核 + 人工审核，一般 12-24 小时完成
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>✓ 通知方式：</strong>{' '}
              如填写邮箱，审核结果将发送至您的邮箱
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>✓ 更新周期：</strong>{' '}
              友链每月审查一次，若网站无法访问或内容违规将被移除
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
