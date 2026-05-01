import fs from 'fs'
import path from 'path'
import {
  getRecentFailedAudits,
  getRecentHighRiskAudits,
  type DashboardRecentFailedTask,
  type DashboardRecentHighRiskAction,
} from '@/lib/admin-audit'
import { getSiteConfig, type SiteConfig } from '@/lib/config'
import { checkLicense } from '@/lib/license'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from './converters'

export type DashboardSummary = {
  postCount: number
  publishedPostCount: number
  draftPostCount: number
  commentCount: number
  pendingCommentCount: number
  totalViews: number
}

export type DashboardRecentPost = {
  id: string
  title: string
  published: boolean
  views: number
  createdAt: Date
}

export type DashboardPendingComment = {
  id: string
  content: string
  guestName: string | null
  createdAt: Date
  post: { title: string; id: string }
}

export type DashboardTopPost = {
  id: string
  title: string
  views: number
}

export type DashboardHealthItem = {
  id: 'license' | 'smtp' | 'comments' | 'security'
  label: string
  tone: 'healthy' | 'warning' | 'danger' | 'info'
  value: string
  description: string
  href: string
  hrefLabel: string
}

export type AdminDashboardData = {
  summary: DashboardSummary
  recentPosts: DashboardRecentPost[]
  pendingComments: DashboardPendingComment[]
  topPosts: DashboardTopPost[]
  recentHighRiskActions: DashboardRecentHighRiskAction[]
  recentFailedTasks: DashboardRecentFailedTask[]
  healthItems: DashboardHealthItem[]
}

const EMPTY_DASHBOARD_DATA: AdminDashboardData = {
  summary: {
    postCount: 0,
    publishedPostCount: 0,
    draftPostCount: 0,
    commentCount: 0,
    pendingCommentCount: 0,
    totalViews: 0,
  },
  recentPosts: [],
  pendingComments: [],
  topPosts: [],
  recentHighRiskActions: [],
  recentFailedTasks: [],
  healthItems: [],
}

type DashboardLicenseStatus = 'authorized' | 'unauthorized' | 'local' | 'unknown'

type SmtpConfigSnapshot = {
  configured: boolean
  user: string
  from: string
}

const ENV_PATH = path.join(process.cwd(), '.env')

function readSmtpConfigSnapshot(): SmtpConfigSnapshot {
  if (!fs.existsSync(ENV_PATH)) {
    return { configured: false, user: '', from: '' }
  }

  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
  }

  return {
    configured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    user: env.SMTP_USER || '',
    from: env.SMTP_FROM || '',
  }
}

function normalizeDashboardHost(currentHost: string) {
  return currentHost.split(',')[0]?.trim().split(':')[0]?.trim() || ''
}

function isLocalHost(host: string) {
  return (
    host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('192.168.') || host.endsWith('.local')
  )
}

function getLoginModeLabel(loginMode?: string) {
  switch (loginMode) {
    case 'secret-click':
      return '隐藏彩蛋'
    case 'both':
      return '双入口'
    case 'path':
    default:
      return '路径登录'
  }
}

async function getDashboardLicenseStatus(currentHost: string): Promise<DashboardLicenseStatus> {
  if (!currentHost) return 'unknown'
  if (isLocalHost(currentHost)) return 'local'

  try {
    return await Promise.race([
      checkLicense(currentHost).then((authorized) =>
        authorized ? ('authorized' as const) : ('unauthorized' as const)
      ),
      new Promise<DashboardLicenseStatus>((resolve) => setTimeout(() => resolve('unknown'), 2500)),
    ])
  } catch (e: unknown) {
    console.warn('[admin-dashboard] licenseStatus:', getErrorMessage(e))
    return 'unknown'
  }
}

function buildDashboardHealthItems({
  currentHost,
  pendingCommentCount,
  siteConfig,
  smtpConfig,
  licenseStatus,
}: {
  currentHost: string
  pendingCommentCount: number
  siteConfig: SiteConfig | null
  smtpConfig: SmtpConfigSnapshot
  licenseStatus: DashboardLicenseStatus
}): DashboardHealthItem[] {
  const licenseDescription = currentHost
    ? `当前域名：${currentHost}${siteConfig?.customDomain ? ` · 配置域名：${siteConfig.customDomain}` : ''}`
    : '当前未获取到访问域名，建议在生产环境再检查授权状态。'

  const licenseItem: DashboardHealthItem =
    licenseStatus === 'authorized'
      ? {
          id: 'license',
          label: '授权状态',
          tone: 'healthy',
          value: '已授权',
          description: licenseDescription,
          href: '/admin/settings',
          hrefLabel: '去站点设置',
        }
      : licenseStatus === 'unauthorized'
        ? {
            id: 'license',
            label: '授权状态',
            tone: 'danger',
            value: '未授权',
            description: `${licenseDescription}，请尽快核对授权。`,
            href: '/admin/settings',
            hrefLabel: '去站点设置',
          }
        : licenseStatus === 'local'
          ? {
              id: 'license',
              label: '授权状态',
              tone: 'info',
              value: '本地环境',
              description: '本地开发环境默认不校验授权，可在上线前再次检查。',
              href: '/admin/settings',
              hrefLabel: '查看授权检查',
            }
          : {
              id: 'license',
              label: '授权状态',
              tone: 'warning',
              value: '待检查',
              description: licenseDescription,
              href: '/admin/settings',
              hrefLabel: '查看授权检查',
            }

  const commentApprovalEnabled = siteConfig?.commentApproval ?? true
  const loginModeLabel = getLoginModeLabel(siteConfig?.loginMode)
  const loginPath = siteConfig?.loginPath || '/admin-login'
  const securityDescription =
    siteConfig?.loginMode === 'secret-click'
      ? `首页点击 Logo ${siteConfig.secretClicks || 5} 次可触发登录。`
      : siteConfig?.loginMode === 'both'
        ? `路径 ${loginPath} 与隐藏彩蛋同时可用。`
        : `当前登录路径：${loginPath}`

  return [
    licenseItem,
    {
      id: 'smtp',
      label: '邮件通知',
      tone: smtpConfig.configured ? 'healthy' : 'warning',
      value: smtpConfig.configured ? '已配置' : '未配置',
      description: smtpConfig.configured
        ? `发件账号：${smtpConfig.from || smtpConfig.user || '已保存配置'}`
        : '评论提醒、测试邮件等功能暂不可用。',
      href: '/admin/settings',
      hrefLabel: smtpConfig.configured ? '去测试邮件' : '去完成配置',
    },
    {
      id: 'comments',
      label: '评论审核',
      tone: commentApprovalEnabled ? (pendingCommentCount > 0 ? 'warning' : 'healthy') : 'info',
      value: commentApprovalEnabled
        ? pendingCommentCount > 0
          ? `${pendingCommentCount} 条待审`
          : '审核已开启'
        : '免审发布',
      description: commentApprovalEnabled
        ? pendingCommentCount > 0
          ? '建议尽快处理积压评论，避免遗漏用户互动。'
          : '新评论需要审核后展示，当前没有积压。'
        : '评论会直接公开显示，注意垃圾评论与风险内容。',
      href: '/admin/comments',
      hrefLabel: '去评论管理',
    },
    {
      id: 'security',
      label: '登录入口',
      tone: 'info',
      value: loginModeLabel,
      description: securityDescription,
      href: '/admin/security',
      hrefLabel: '去安全设置',
    },
  ]
}

async function safeQuery<T>(label: string, query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query
  } catch (e: unknown) {
    console.warn(`[admin-dashboard] ${label}:`, getErrorMessage(e))
    return fallback
  }
}

export async function getAdminDashboardData(currentHost = ''): Promise<AdminDashboardData> {
  const normalizedHost = normalizeDashboardHost(currentHost)

  const [
    postCount,
    publishedPostCount,
    commentCount,
    pendingCommentCount,
    totalViewsResult,
    recentPosts,
    pendingComments,
    topPosts,
    recentHighRiskActions,
    recentFailedTasks,
    siteConfig,
    licenseStatus,
  ] = await Promise.all([
    safeQuery('postCount', prisma.post.count(), 0),
    safeQuery('publishedPostCount', prisma.post.count({ where: { published: true } }), 0),
    safeQuery('commentCount', prisma.comment.count(), 0),
    safeQuery('pendingCommentCount', prisma.comment.count({ where: { approved: false } }), 0),
    safeQuery('totalViews', prisma.post.aggregate({ _sum: { views: true } }), { _sum: { views: null } }),
    safeQuery(
      'recentPosts',
      prisma.post.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, published: true, views: true, createdAt: true },
      }),
      [] as DashboardRecentPost[]
    ),
    safeQuery(
      'pendingComments',
      prisma.comment.findMany({
        where: { approved: false },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          guestName: true,
          createdAt: true,
          post: { select: { title: true, id: true } },
        },
      }),
      [] as DashboardPendingComment[]
    ),
    safeQuery(
      'topPosts',
      prisma.post.findMany({
        where: { published: true },
        take: 5,
        orderBy: { views: 'desc' },
        select: { id: true, title: true, views: true },
      }),
      [] as DashboardTopPost[]
    ),
    safeQuery('recentHighRiskActions', getRecentHighRiskAudits(5), [] as DashboardRecentHighRiskAction[]),
    safeQuery('recentFailedTasks', getRecentFailedAudits(5), [] as DashboardRecentFailedTask[]),
    safeQuery('siteConfig', getSiteConfig(), null as SiteConfig | null),
    getDashboardLicenseStatus(normalizedHost),
  ])

  return {
    ...EMPTY_DASHBOARD_DATA,
    summary: {
      postCount,
      publishedPostCount,
      draftPostCount: Math.max(0, postCount - publishedPostCount),
      commentCount,
      pendingCommentCount,
      totalViews: totalViewsResult._sum.views || 0,
    },
    recentPosts,
    pendingComments,
    topPosts,
    recentHighRiskActions,
    recentFailedTasks,
    healthItems: buildDashboardHealthItems({
      currentHost: normalizedHost,
      pendingCommentCount,
      siteConfig,
      smtpConfig: readSmtpConfigSnapshot(),
      licenseStatus,
    }),
  }
}
