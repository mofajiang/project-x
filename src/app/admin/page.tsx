import Link from 'next/link'
import { headers } from 'next/headers'
import { AdminSysInfo } from '@/components/admin/AdminSysInfo'
import { AdminVisitorMap } from '@/components/admin/AdminVisitorMap'
import { AdminRightPanel } from '@/components/admin/AdminRightPanel'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'
import { getAdminDashboardData, type DashboardHealthItem } from '@/lib/admin-dashboard'

const HEALTH_TONE_STYLES: Record<DashboardHealthItem['tone'], { badgeBg: string; badgeColor: string; border: string }> = {
  healthy: { badgeBg: 'rgba(0,186,124,0.14)', badgeColor: 'var(--green)', border: 'rgba(0,186,124,0.18)' },
  warning: { badgeBg: 'rgba(255,179,71,0.16)', badgeColor: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  danger: { badgeBg: 'rgba(249,24,128,0.14)', badgeColor: 'var(--red)', border: 'rgba(249,24,128,0.22)' },
  info: { badgeBg: 'rgba(29,155,240,0.14)', badgeColor: 'var(--accent)', border: 'rgba(29,155,240,0.2)' },
}

const HEALTH_TONE_LABELS: Record<DashboardHealthItem['tone'], string> = {
  healthy: '正常',
  warning: '关注',
  danger: '告警',
  info: '提示',
}

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const headerStore = headers()
  const currentHost = headerStore.get('x-forwarded-host') || headerStore.get('host') || ''
  const dashboard = await getAdminDashboardData(currentHost)
  const { summary, recentPosts, healthItems } = dashboard

  const stats = [
    { label: '全部文章', value: summary.postCount, icon: '📚' },
    { label: '已发布文章', value: summary.publishedPostCount, icon: '📝' },
    { label: '草稿箱', value: summary.draftPostCount, icon: '🗂️' },
    { label: '总浏览量', value: summary.totalViews, icon: '📊' },
    { label: '全部评论', value: summary.commentCount, icon: '💬' },
    { label: '待审评论', value: summary.pendingCommentCount, icon: '⏳', alert: summary.pendingCommentCount > 0 },
  ]

  return (

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 items-start">
      {/* 左侧主内容 */}
      <div className="min-w-0">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: s.alert ? 'rgba(249,24,128,0.08)' : 'var(--bg-secondary)', boxShadow: s.alert ? 'inset 0 0 0 1px var(--red)' : 'none' }}>
              <p className="text-xl font-black leading-tight tabular-nums" style={{ color: s.alert ? 'var(--red)' : 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] leading-snug mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* 管理健康 */}
        <div className="rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8" style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>管理健康</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>把授权、邮件、评论审核和登录入口状态集中到首页。</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{healthItems.length} 项检查</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {healthItems.map(item => {
              const tone = HEALTH_TONE_STYLES[item.tone]

              return (
                <div
                  key={item.id}
                  className="rounded-2xl p-3 sm:p-4"
                  style={{ background: 'var(--bg-hover)', boxShadow: `inset 0 0 0 1px ${tone.border}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                      <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: tone.badgeBg, color: tone.badgeColor }}>
                      {HEALTH_TONE_LABELS[item.tone]}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                  <div className="mt-3 flex justify-end">
                    <Link href={item.href} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                      {item.hrefLabel} →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
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

        <div className="mt-6 sm:mt-8">
          <AdminVisitorMap />
        </div>
      </div>

      {/* 右侧栏 */}
      <div className="xl:pl-6 xl:border-l border-[color:var(--border)]">
        <div className="mb-3 flex items-center justify-between xl:hidden">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>快捷面板</h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>手机端可用</span>
        </div>
        <AdminRightPanel dashboard={dashboard} />

      </div>
    </div>
  )
}
