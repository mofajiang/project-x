import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/')

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <AdminSidebar username={session.username} />
      <main className="flex-1 min-h-screen p-4 md:p-6 overflow-y-auto pt-[72px] pb-24 md:pt-6 md:pb-6" style={{ borderLeft: '1px solid var(--border)' }}>
        {children}
      </main>
    </div>
  )
}
