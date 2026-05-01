import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'
import type { JWTPayload } from './auth'
import { prisma } from './prisma'
import { getErrorMessage } from './converters'

export type AdminAuditRiskLevel = 'medium' | 'high' | 'critical'
export type AdminAuditStatus = 'success' | 'failed'

export type AdminAuditAction =
  | 'config.updated'
  | 'security.config.updated'
  | 'smtp.updated'
  | 'system.updated'
  | 'password.changed'
  | 'visitor.logs.cleared'
  | 'post.deleted'

export type DashboardRecentHighRiskAction = {
  id: string
  action: string
  label: string
  summary: string
  targetType: string | null
  targetId: string | null
  riskLevel: AdminAuditRiskLevel
  status: AdminAuditStatus
  actorUsername: string
  createdAt: Date
}

export type DashboardRecentFailedTask = DashboardRecentHighRiskAction & {
  detail: string
  href: string
  hrefLabel: string
}

type AdminAuditMetadata = Record<string, unknown> | null

type AdminAuditRow = {
  id: string
  action: string
  summary: string
  targetType: string | null
  targetId: string | null
  riskLevel: AdminAuditRiskLevel
  status: AdminAuditStatus
  actorUsername: string | null
  createdAt: string
  metadata?: string | null
}

type AdminAuditActor = Pick<JWTPayload, 'userId' | 'username'>

const ACTION_LABELS: Record<string, string> = {
  'config.updated': '更新站点配置',
  'security.config.updated': '更新安全配置',
  'smtp.updated': '更新 SMTP 配置',
  'system.updated': '执行系统更新',
  'password.changed': '修改管理员密码',
  'visitor.logs.cleared': '清空访客日志',
  'post.deleted': '删除文章',
}

const NAVIGATION_CONFIG_KEYS = new Set(['navItems', 'rightPanelWidgets'])
const VISITOR_CONFIG_KEYS = new Set([
  'visitorGeoMode',
  'visitorGeoKey',
  'visitorGeoEndpoint',
  'visitorMapSource',
  'visitorStatsDisplay',
])

export function getAdminAuditActionLabel(action: string) {
  return ACTION_LABELS[action] || action
}

export function getRequestIp(req: NextRequest | { headers: Headers }) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || ''
}

export async function logAdminAudit({
  action,
  summary,
  riskLevel = 'high',
  status = 'success',
  targetType = null,
  targetId = null,
  actor = null,
  ip = '',
  metadata = null,
}: {
  action: AdminAuditAction | string
  summary: string
  riskLevel?: AdminAuditRiskLevel
  status?: AdminAuditStatus
  targetType?: string | null
  targetId?: string | null
  actor?: AdminAuditActor | null
  ip?: string
  metadata?: Record<string, unknown> | null
}) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO AdminAuditLog (id, action, summary, targetType, targetId, riskLevel, status, actorId, actorUsername, ip, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      action,
      summary,
      targetType,
      targetId,
      riskLevel,
      status,
      actor?.userId || '',
      actor?.username || '',
      ip,
      metadata ? JSON.stringify(metadata) : '',
      new Date().toISOString()
    )
  } catch (e: unknown) {
    console.warn('[admin-audit] write failed:', getErrorMessage(e))
  }
}

function normalizeAuditLimit(limit: number) {
  return Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 20) : 5
}

function parseAdminAuditMetadata(raw?: string | null): AdminAuditMetadata {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function getMetadataString(metadata: AdminAuditMetadata, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getMetadataStringArray(metadata: AdminAuditMetadata, key: string) {
  const value = metadata?.[key]
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : []
}

function truncateAuditText(text: string, max = 120) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatAuditStage(stage: string) {
  switch (stage) {
    case 'git-pull':
      return '拉取代码'
    case 'build':
      return '构建发布'
    case 'unknown':
      return '未知阶段'
    default:
      return stage
  }
}

function getAdminAuditDetail(action: string, metadata: AdminAuditMetadata, targetId: string | null) {
  const error = getMetadataString(metadata, 'error').replace(/\s+/g, ' ')
  const stage = getMetadataString(metadata, 'stage')
  const changedKeys = getMetadataStringArray(metadata, 'changedKeys')

  if (error) {
    const stagePrefix = action === 'system.updated' && stage ? `失败阶段：${formatAuditStage(stage)}；` : ''
    return `${stagePrefix}${truncateAuditText(error)}`
  }

  if (changedKeys.length) {
    return `涉及字段：${changedKeys.slice(0, 4).join('、')}${changedKeys.length > 4 ? ` 等 ${changedKeys.length} 项` : ''}`
  }

  if (action === 'system.updated' && stage) {
    return `失败阶段：${formatAuditStage(stage)}`
  }

  if (targetId) {
    return `对象 ID：${targetId}`
  }

  return ''
}

function getAdminAuditHref(action: string, metadata: AdminAuditMetadata) {
  const changedKeys = getMetadataStringArray(metadata, 'changedKeys')

  if (action === 'config.updated') {
    if (changedKeys.some((key) => NAVIGATION_CONFIG_KEYS.has(key))) {
      return { href: '/admin/navigation', hrefLabel: '去导航设置' }
    }

    if (changedKeys.some((key) => VISITOR_CONFIG_KEYS.has(key))) {
      return { href: '/admin', hrefLabel: '去仪表盘' }
    }

    return { href: '/admin/settings', hrefLabel: '去站点设置' }
  }

  if (action === 'security.config.updated' || action === 'password.changed') {
    return { href: '/admin/security', hrefLabel: '去安全设置' }
  }

  if (action === 'smtp.updated') {
    return { href: '/admin/settings', hrefLabel: '去站点设置' }
  }

  if (action === 'system.updated') {
    return { href: '/admin', hrefLabel: '查看更新入口' }
  }

  if (action === 'visitor.logs.cleared') {
    return { href: '/admin', hrefLabel: '回到仪表盘' }
  }

  if (action === 'post.deleted') {
    return { href: '/admin/posts', hrefLabel: '去文章管理' }
  }

  return { href: '/admin', hrefLabel: '去处理' }
}

function mapAdminAuditRow(row: AdminAuditRow): DashboardRecentHighRiskAction {
  return {
    id: row.id,
    action: row.action,
    label: getAdminAuditActionLabel(row.action),
    summary: row.summary,
    targetType: row.targetType,
    targetId: row.targetId,
    riskLevel: row.riskLevel,
    status: row.status,
    actorUsername: row.actorUsername || '管理员',
    createdAt: new Date(row.createdAt),
  }
}

function mapFailedAdminAuditRow(row: AdminAuditRow): DashboardRecentFailedTask {
  const metadata = parseAdminAuditMetadata(row.metadata)
  const { href, hrefLabel } = getAdminAuditHref(row.action, metadata)

  return {
    ...mapAdminAuditRow(row),
    detail: getAdminAuditDetail(row.action, metadata, row.targetId),
    href,
    hrefLabel,
  }
}

export async function getRecentHighRiskAudits(limit = 5): Promise<DashboardRecentHighRiskAction[]> {
  const safeLimit = normalizeAuditLimit(limit)

  try {
    const rows = await prisma.$queryRawUnsafe<AdminAuditRow[]>(
      `SELECT id, action, summary, targetType, targetId, riskLevel, status, actorUsername, createdAt
       FROM AdminAuditLog
       WHERE riskLevel IN ('high', 'critical')
       ORDER BY createdAt DESC
       LIMIT ?`,
      safeLimit
    )

    return rows.map(mapAdminAuditRow)
  } catch (e: unknown) {
    console.warn('[admin-audit] recent high risk query failed:', getErrorMessage(e))
    return []
  }
}

export async function getRecentFailedAudits(limit = 5): Promise<DashboardRecentFailedTask[]> {
  const safeLimit = normalizeAuditLimit(limit)

  try {
    const rows = await prisma.$queryRawUnsafe<AdminAuditRow[]>(
      `SELECT id, action, summary, targetType, targetId, riskLevel, status, actorUsername, createdAt, metadata
       FROM AdminAuditLog
       WHERE status = 'failed'
       ORDER BY createdAt DESC
       LIMIT ?`,
      safeLimit
    )

    return rows.map(mapFailedAdminAuditRow)
  } catch (e: unknown) {
    console.warn('[admin-audit] recent failed query failed:', getErrorMessage(e))
    return []
  }
}
