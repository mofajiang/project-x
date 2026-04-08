import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MobileNav } from '@/components/admin/MobileNav'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

const getPendingCount = unstable_cache(
  () => prisma.comment.count({ where: { approved: false } }),
  ['pending-comments'],
  { revalidate: 30, tags: ['comments'] }
)

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/')

  const pendingComments = await getPendingCount()

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
