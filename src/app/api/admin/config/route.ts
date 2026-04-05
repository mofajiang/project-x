import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getSiteConfig, revalidateSiteConfig } from '@/lib/config'
import { runMigrations } from '@/lib/db-migrate'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'

const SECURITY_CONFIG_KEYS = new Set(['loginPath', 'loginMode', 'secretClicks', 'customDomain'])

function getConfigAuditPayload(changedKeys: string[]) {
  const preview = changedKeys.slice(0, 4)
  const suffix = changedKeys.length > 4 ? ` 等 ${changedKeys.length} 项` : ''

  if (changedKeys.some(key => SECURITY_CONFIG_KEYS.has(key))) {
    return {
      action: 'security.config.updated' as const,
      riskLevel: 'critical' as const,
      summary: preview.length ? `更新安全配置：${preview.join('、')}${suffix}` : '更新安全配置',
    }
  }

  return {
    action: 'config.updated' as const,
    riskLevel: 'high' as const,
    summary: preview.length ? `更新站点配置：${preview.join('、')}${suffix}` : '更新站点配置',
  }
}


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
  const requestIp = getRequestIp(req)
  const data = await req.json()
  delete data.id
  const changedKeys = Object.keys(data)
  const auditPayload = getConfigAuditPayload(changedKeys)


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

  // 动态迁移列（siteIcon / siteLogo / rightPanelWidgets / visitorGeoMode / visitorGeoKey / visitorGeoEndpoint / visitorMapSource / visitorStatsDisplay / copyright / defaultTheme / customDomain）Prisma schema 不认识，需单独处理
  const siteIcon = data.siteIcon ?? null
  const siteLogo = data.siteLogo ?? null
  const rightPanelWidgets = data.rightPanelWidgets ?? null
  const visitorGeoMode = data.visitorGeoMode ?? null
  const visitorGeoKey = data.visitorGeoKey ?? null
  const visitorGeoEndpoint = data.visitorGeoEndpoint ?? null
  const visitorMapSource = data.visitorMapSource ?? null
  const visitorStatsDisplay = data.visitorStatsDisplay ?? null
  const copyright = data.copyright ?? null
  const defaultTheme = data.defaultTheme ?? null
  const customDomain = data.customDomain !== undefined ? (data.customDomain ?? '') : null
  delete data.siteIcon
  delete data.siteLogo
  delete data.rightPanelWidgets
  delete data.visitorGeoMode
  delete data.visitorGeoKey
  delete data.visitorGeoEndpoint
  delete data.visitorMapSource
  delete data.visitorStatsDisplay
  delete data.copyright
  delete data.defaultTheme
  delete data.customDomain

  // SQLite 存的是 0/1 整数，Prisma schema 要求 Boolean，需显式转换
  if (data.showCommentIp !== undefined) data.showCommentIp = Boolean(data.showCommentIp)
  if (data.commentApproval !== undefined) data.commentApproval = Boolean(data.commentApproval)
  if (data.enableAiDetection !== undefined) data.enableAiDetection = Boolean(data.enableAiDetection)
  if (data.aiAutoApprove !== undefined) data.aiAutoApprove = Boolean(data.aiAutoApprove)

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
    await logAdminAudit({
      ...auditPayload,
      status: 'failed',
      targetType: 'siteConfig',
      targetId: 'singleton',
      actor: session,
      ip: requestIp,
      metadata: { changedKeys, error: e?.message || 'upsert failed' },
    })
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
  if (visitorMapSource !== null) rawUpdates.push({ col: 'visitorMapSource', val: visitorMapSource })
  if (visitorStatsDisplay !== null) rawUpdates.push({ col: 'visitorStatsDisplay', val: visitorStatsDisplay })
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
  await logAdminAudit({
    ...auditPayload,
    targetType: 'siteConfig',
    targetId: 'singleton',
    actor: session,
    ip: requestIp,
    metadata: { changedKeys },
  })
  return NextResponse.json(config)
}

