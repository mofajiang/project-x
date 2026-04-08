import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MobileNav } from '@/components/admin/MobileNav'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/')

  // 获取待审核评论数
  const pendingComments = await prisma.comment.count({ where: { approved: false } })

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg)' }}>
      <AdminSidebar username={session.username} />
      <MobileNav username={session.username} pendingCount={pendingComments} />
      <main className="flex-1 min-h-screen min-w-0 p-3 lg:p-4 overflow-y-auto overflow-x-hidden pt-[70px] lg:pt-4 pb-4" style={{ borderLeft: '1px solid var(--border)' }}>
        {children}
      </main>
    </div>
  )
}
