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
  try { await runMigrations() } catch (e: any) { console.warn('[config PUT] runMigrations:', e?.message) }
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

  // 动态迁移列（siteIcon / siteLogo / rightPanelWidgets / visitorGeoMode / visitorGeoKey / visitorGeoEndpoint / copyright / defaultTheme / customDomain）Prisma schema 不认识，需单独处理
  const siteIcon = data.siteIcon ?? null
  const siteLogo = data.siteLogo ?? null
  const rightPanelWidgets = data.rightPanelWidgets ?? null
  const visitorGeoMode = data.visitorGeoMode ?? null
  const visitorGeoKey = data.visitorGeoKey ?? null
  const visitorGeoEndpoint = data.visitorGeoEndpoint ?? null
  const copyright = data.copyright ?? null
  const defaultTheme = data.defaultTheme ?? null
  const customDomain = data.customDomain !== undefined ? (data.customDomain ?? '') : null
  delete data.siteIcon
  delete data.siteLogo
  delete data.rightPanelWidgets
  delete data.visitorGeoMode
  delete data.visitorGeoKey
  delete data.visitorGeoEndpoint
  delete data.copyright
  delete data.defaultTheme
  delete data.customDomain

  // 先 upsert Prisma 已知字段
  let config: any
  try {
    config = await prisma.siteConfig.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    })
  } catch (e: any) {
    console.error('[config PUT] upsert failed:', e?.message)
    return NextResponse.json({ error: '保存失败', detail: e?.message }, { status: 500 })
  }

  // 再用 raw SQL 逐列更新动态列，每列独立 try/catch 互不影响
  const rawUpdates: Array<{ col: string; val: string }> = []
  if (siteIcon !== null) rawUpdates.push({ col: 'siteIcon', val: siteIcon })
  if (siteLogo !== null) rawUpdates.push({ col: 'siteLogo', val: siteLogo })
  if (rightPanelWidgets !== null) rawUpdates.push({ col: 'rightPanelWidgets', val: rightPanelWidgets })
  if (visitorGeoMode !== null) rawUpdates.push({ col: 'visitorGeoMode', val: visitorGeoMode })
  if (visitorGeoKey !== null) rawUpdates.push({ col: 'visitorGeoKey', val: visitorGeoKey })
  if (visitorGeoEndpoint !== null) rawUpdates.push({ col: 'visitorGeoEndpoint', val: visitorGeoEndpoint })
  if (copyright !== null) rawUpdates.push({ col: 'copyright', val: copyright })
  if (defaultTheme !== null) rawUpdates.push({ col: 'defaultTheme', val: defaultTheme })
  if (customDomain !== null) rawUpdates.push({ col: 'customDomain', val: customDomain })

  for (const { col, val } of rawUpdates) {
    try {
      await prisma.$executeRawUnsafe(`UPDATE SiteConfig SET ${col} = ? WHERE id = 'singleton'`, val)
    } catch (e: any) {
      console.warn(`[config PUT] raw update ${col}:`, e?.message)
    }
  }

  await revalidateSiteConfig()
  return NextResponse.json(config)
}
