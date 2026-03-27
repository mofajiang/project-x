import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminSysInfo } from '@/components/admin/AdminSysInfo'
import { AdminRightPanel } from '@/components/admin/AdminRightPanel'

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
    <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
      {/* 左侧主内容 */}
      <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: s.alert ? 'rgba(249,24,128,0.08)' : 'var(--bg-secondary)', boxShadow: s.alert ? 'inset 0 0 0 1px var(--red)' : 'none' }}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold" style={{ color: s.alert ? 'var(--red)' : 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 最近文章 */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>最近文章</h2>
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

      {/* 运行状态 */}
      <h2 className="font-bold text-lg mt-2 mb-4" style={{ color: 'var(--text-primary)' }}>运行状态</h2>
      <AdminSysInfo />
      </div>

      {/* 右侧栏 */}
      <div className="hidden xl:block" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>
        <AdminRightPanel />
      </div>
    </div>
  )
}
