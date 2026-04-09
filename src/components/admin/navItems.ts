export type AdminNavItem = {
  label: string
  href: string
  icon: string
  badge?: boolean
  group?: string
}

export const ADMIN_NAV_GROUPS = [
  { key: 'content', label: '内容管理' },
  { key: 'appearance', label: '外观与资源' },
  { key: 'system', label: '系统设置' },
]

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: '仪表盘', href: '/admin', icon: '📊', group: 'content' },
  { label: '文章管理', href: '/admin/posts', icon: '📝', group: 'content' },
  { label: '评论管理', href: '/admin/comments', icon: '💬', badge: true, group: 'content' },
  { label: '标签管理', href: '/admin/tags', icon: '🏷', group: 'content' },
  { label: '友链管理', href: '/admin/friend-links', icon: '🔗', group: 'content' },
  { label: '上传管理', href: '/admin/uploads', icon: '🗂️', group: 'appearance' },
  { label: '导航与组件', href: '/admin/navigation', icon: '🧭', group: 'appearance' },
  { label: 'AI 模型管理', href: '/admin/ai-model', icon: '🤖', group: 'system' },
  { label: '系统日志', href: '/admin/logs', icon: '📋', group: 'system' },
  { label: '安全设置', href: '/admin/security', icon: '🔒', group: 'system' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️', group: 'system' },
]
