import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: '管理员登录' }

export default async function AdminLoginPage() {
  const session = await getSession()
  if (session) redirect('/admin')

  return <LoginForm loginPath="/admin/login" />
}
