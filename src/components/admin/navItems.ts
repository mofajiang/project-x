export type AdminNavItem = {
  label: string
  href: string
  icon: string
  badge?: boolean
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '文章管理', href: '/admin/posts', icon: '📝' },
  { label: '评论管理', href: '/admin/comments', icon: '💬', badge: true },
  { label: '标签管理', href: '/admin/tags', icon: '🏷' },
  { label: '友链管理', href: '/admin/friend-links', icon: '🔗' },
  { label: '上传管理', href: '/admin/uploads', icon: '🗂️' },
  { label: 'AI 模型管理', href: '/admin/ai-model', icon: '🤖' },
  { label: '安全设置', href: '/admin/security', icon: '🔒' },
  { label: '站点设置', href: '/admin/settings', icon: '⚙️' },
  { label: '导航与组件', href: '/admin/navigation', icon: '🧭' },
]
