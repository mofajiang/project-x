import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getSiteConfig, revalidateSiteConfig } from '@/lib/config'
import { runMigrations } from '@/lib/db-migrate'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await runMigrations()
  const config = await getSiteConfig()
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await runMigrations()
  const data = await req.json()
  delete data.id

  // navItems 若为数组则序列化为 JSON 字符串
  if (Array.isArray(data.navItems)) {
    data.navItems = JSON.stringify(data.navItems)
  }
  // rightPanelWidgets 若为数组则序列化
  if (Array.isArray(data.rightPanelWidgets)) {
    data.rightPanelWidgets = JSON.stringify(data.rightPanelWidgets)
  }
  if (data.siteLogo && typeof data.siteLogo === 'object') {
    data.siteLogo = JSON.stringify(data.siteLogo)
  }

  // 动态迁移列（siteIcon / siteLogo / rightPanelWidgets / visitorGeoMode / visitorGeoEndpoint / copyright / defaultTheme / customDomain）Prisma schema 不认识，需单独处理
  const siteIcon = data.siteIcon ?? null
  const siteLogo = data.siteLogo ?? null
  const rightPanelWidgets = data.rightPanelWidgets ?? null
  const visitorGeoMode = data.visitorGeoMode ?? null
  const visitorGeoEndpoint = data.visitorGeoEndpoint ?? null
  const copyright = data.copyright ?? null
  const defaultTheme = data.defaultTheme ?? null
  const customDomain = data.customDomain !== undefined ? (data.customDomain ?? '') : null
  delete data.siteIcon
  delete data.siteLogo
  delete data.rightPanelWidgets
  delete data.visitorGeoMode
  delete data.visitorGeoEndpoint
  delete data.copyright
  delete data.defaultTheme
  delete data.customDomain

  // 先 upsert Prisma 已知字段
  const config = await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  })

  // 再用 raw SQL 更新动态列
  try {
    if (siteIcon !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET siteIcon = ? WHERE id = 'singleton'`, siteIcon)
    }
    if (siteLogo !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET siteLogo = ? WHERE id = 'singleton'`, siteLogo)
    }
    if (rightPanelWidgets !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET rightPanelWidgets = ? WHERE id = 'singleton'`, rightPanelWidgets)
    }
    if (visitorGeoMode !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET visitorGeoMode = ? WHERE id = 'singleton'`, visitorGeoMode)
    }
    if (visitorGeoEndpoint !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET visitorGeoEndpoint = ? WHERE id = 'singleton'`, visitorGeoEndpoint)
    }
    if (copyright !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET copyright = ? WHERE id = 'singleton'`, copyright)
    }
    if (defaultTheme !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET defaultTheme = ? WHERE id = 'singleton'`, defaultTheme)
    }
    if (customDomain !== null) {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET customDomain = ? WHERE id = 'singleton'`, customDomain)
    }
  } catch (e: any) {
    console.warn('[config PUT] raw update:', e?.message)
  }

  await revalidateSiteConfig()
  return NextResponse.json(config)
}
