import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminSysInfo } from '@/components/admin/AdminSysInfo'
import { AdminRightPanel } from '@/components/admin/AdminRightPanel'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [postCount, commentCount, pendingComments, totalViews] = await Promise.all([
    prisma.post.count({ where: { published: true } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { approved: false } }),
    prisma.post.aggregate({ _sum: { views: true } }),
  ])

  const recentPosts = await prisma.post.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, published: true, views: true, createdAt: true },
  })

  const stats = [
    { label: '已发布文章', value: postCount, icon: '📝' },
    { label: '总浏览量', value: totalViews._sum.views || 0, icon: '📊' },
    { label: '全部评论', value: commentCount, icon: '💬' },
    { label: '待审评论', value: pendingComments, icon: '⏳', alert: pendingComments > 0 },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 items-start">
      {/* 左侧主内容 */}
      <div className="min-w-0">
        <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>仪表盘</h1>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {stats.map(s => (
            <div key={s.label} className={ADMIN_CARD_CLASS} style={{ background: s.alert ? 'rgba(249,24,128,0.08)' : 'var(--bg-secondary)', boxShadow: s.alert ? 'inset 0 0 0 1px var(--red)' : 'none' }}>
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold" style={{ color: s.alert ? 'var(--red)' : 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* 最近文章 */}
        <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8" style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>最近文章</h2>
            <Link href="/admin/posts" className="text-sm" style={{ color: 'var(--accent)' }}>查看全部 →</Link>
          </div>

          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th className="text-left px-4 py-3">标题</th>
                  <th className="text-left px-4 py-3">状态</th>
                  <th className="text-left px-4 py-3">浏览</th>
                </tr>
              </thead>
              <tbody>
                {recentPosts.map(post => (
                  <tr key={post.id} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      <Link href={`/admin/posts/${post.id}`} className="hover:underline font-medium">{post.title}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: post.published ? '#00BA7C22' : '#71767B22', color: post.published ? 'var(--green)' : 'var(--text-secondary)' }}>
                        {post.published ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{post.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden flex flex-col gap-3 p-4 pt-3">
            {recentPosts.map(post => (
              <Link key={post.id} href={`/admin/posts/${post.id}`} className="rounded-2xl p-3 transition-colors" style={{ background: 'var(--bg-hover)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm leading-5 truncate" style={{ color: 'var(--text-primary)' }}>{post.title}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>浏览 {post.views}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] shrink-0" style={{ background: post.published ? '#00BA7C22' : '#71767B22', color: post.published ? 'var(--green)' : 'var(--text-secondary)' }}>
                    {post.published ? '已发布' : '草稿'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 运行状态 */}
        <h2 className="font-bold text-lg mt-2 mb-4" style={{ color: 'var(--text-primary)' }}>运行状态</h2>
        <AdminSysInfo />
      </div>

      {/* 右侧栏 */}
      <div className="xl:pl-6 xl:border-l border-[color:var(--border)]">
        <div className="mb-3 flex items-center justify-between xl:hidden">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>快捷面板</h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>手机端可用</span>
        </div>
        <AdminRightPanel />
      </div>
    </div>
  )
}
