import { prisma } from '@/lib/prisma'
import { AdminRightPanelClient } from './AdminRightPanelClient'

export async function AdminRightPanel() {
  const [pendingComments, topPosts] = await Promise.all([
    prisma.comment.findMany({
      where: { approved: false },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        guestName: true,
        createdAt: true,
        post: { select: { title: true, id: true } },
      },
    }),
    prisma.post.findMany({
      where: { published: true },
      take: 5,
      orderBy: { views: 'desc' },
      select: { id: true, title: true, views: true },
    }),
  ])

  const quickLinks = [
    { href: '/admin/posts/new', label: '写新文章', icon: '✏️' },
    { href: '/admin/comments', label: '管理评论', icon: '💬', badge: pendingComments.length },  
    { href: '/admin/tags', label: '管理标签', icon: '🏷️' },
    { href: '/admin/settings', label: '站点设置', icon: '⚙️' },
    { href: '/admin/smtp', label: '邮件设置', icon: '📧' },
    { href: '/admin/security', label: '安全设置', icon: '🔒' },
  ]

  return (
    <AdminRightPanelClient
      quickLinks={quickLinks}
      pendingComments={pendingComments}
      topPosts={topPosts}
    />
  )
}
