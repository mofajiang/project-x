import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { checkLicense } from '@/lib/license'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await runMigrations()

  // 优先级：1. 数据库中绑定的自定义域名  2. NEXT_PUBLIC_SITE_URL 环境变量  3. 请求头
  let currentHost = ''
  let source = 'header'

  try {
    // 读取数据库中用户手动绑定的域名
    const rows = await prisma.$queryRawUnsafe<{ customDomain: string }[]>(
      `SELECT customDomain FROM SiteConfig WHERE id = 'singleton' LIMIT 1`
    )
    const dbDomain = rows?.[0]?.customDomain?.trim()
    if (dbDomain) {
      currentHost = dbDomain.replace(/^https?:\/\//, '').split('/')[0]
      source = 'db'
    }
  } catch {}

  if (!currentHost) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    try {
      if (siteUrl) {
        currentHost = new URL(siteUrl).hostname
        source = 'env'
      } else {
        const forwarded = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
        currentHost = forwarded.split(':')[0]
      }
    } catch {
      currentHost = (req.headers.get('host') || '').split(':')[0]
    }
  }

  // 如果仍然是 localhost/127.x，说明域名未配置
  const isLocal = currentHost.startsWith('localhost') || currentHost.startsWith('127.') || currentHost.startsWith('192.168.')
  if (isLocal) {
    return NextResponse.json({
      authorized: false,
      domains: [],
      currentHost,
      source,
      error: '尚未绑定域名，请在「站点设置 → 域名绑定」中填写您的域名'
    })
  }

  try {
    const authorized = await checkLicense(currentHost)
    return NextResponse.json({ authorized, domains: [], currentHost, source })
  } catch {
    return NextResponse.json({ authorized: false, domains: [], currentHost, source, error: 'cannot reach license server' })
  }
}
