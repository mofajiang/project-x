import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { LoginForm } from '@/components/auth/LoginForm'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function DynamicLoginPage({ params }: { params: { loginPath: string } }) {
  // 已登录则直接跳转到后台
  const session = await getSession()
  if (session) redirect('/admin')

  // 从数据库读取合法登录路径
  let config = await prisma.siteConfig.findUnique({ where: { id: 'singleton' } })
  if (!config) {
    config = await prisma.siteConfig.create({ data: { id: 'singleton' } })
  }

  const expectedPath = config.loginPath.replace(/^\//, '')
  const mode = config.loginMode

  // 路径不匹配 且 模式不是 secret-click → 404
  if (params.loginPath !== expectedPath && mode !== 'secret-click') {
    notFound()
  }

  // 如果是纯彩蛋模式但有人直接访问路径 → 404
  if (mode === 'secret-click' && params.loginPath !== expectedPath) {
    notFound()
  }

  return <LoginForm loginPath={config.loginPath} />
}
