import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getSiteConfig, parseSiteLogo, type SiteLogo } from '@/lib/config'
import { LoginForm } from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: '管理员登录' }

export default async function AdminLoginPage() {
  const session = await getSession()
  if (session) redirect('/admin')

  const config = await getSiteConfig()
  const siteLogo = parseSiteLogo(config.siteLogo)
  const siteIcon = config.siteIcon || ''

  return <LoginForm loginPath="/admin/login" siteLogo={siteLogo} siteIcon={siteIcon} />
}
