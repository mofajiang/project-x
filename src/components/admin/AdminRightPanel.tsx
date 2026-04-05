import { type AdminDashboardData } from '@/lib/admin-dashboard'
import { AdminRightPanelClient } from './AdminRightPanelClient'

export function AdminRightPanel({ dashboard }: { dashboard: AdminDashboardData }) {
  const quickLinks = [
    { href: '/admin/posts/new', label: '写新文章', icon: '✏️' },
    { href: '/admin/comments', label: '管理评论', icon: '💬', badge: dashboard.summary.pendingCommentCount },
    { href: '/admin/tags', label: '管理标签', icon: '🏷️' },
    { href: '/admin/navigation', label: '导航设置', icon: '🧭' },
    { href: '/admin/settings', label: '站点与邮件', icon: '⚙️' },
    { href: '/admin/security', label: '安全设置', icon: '🔒' },
  ]


  return (
    <AdminRightPanelClient
      quickLinks={quickLinks}
      recentFailedTasks={dashboard.recentFailedTasks}
      recentHighRiskActions={dashboard.recentHighRiskActions}
      pendingComments={dashboard.pendingComments}
      topPosts={dashboard.topPosts}
    />
  )
}



