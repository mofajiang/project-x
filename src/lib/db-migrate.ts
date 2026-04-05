/**
 * 自动数据库迁移 — 在应用首次启动时补充缺失的列
 * 无需手动执行 prisma db push
 */
import { prisma } from './prisma'

let migrated = false
let migratePromise: Promise<void> | null = null

async function addColumn(table: string, column: string, definition: string, label: string) {
  try {
    // 先检查列是否已存在。SQLite pragma_table_info 不支持参数绑定，需用字面量表名。
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM pragma_table_info('${table}') WHERE name = ?`, column
    )
    if (rows.length > 0) return // 列已存在，跳过
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    console.log(`[migrate] ${label} 添加成功`)
  } catch (e: any) {
    console.warn(`[migrate] ${label}:`, e?.message)
  }
}

async function createTable(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`[migrate] ${label} 创建成功`)
  } catch (e: any) {
    if (!e?.message?.includes('already exists')) {
      console.warn(`[migrate] ${label}:`, e?.message)
    }
  }
}

async function createIndex(table: string, index: string, columns: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${index} ON ${table}(${columns})`)
    console.log(`[migrate] ${label} 创建成功`)
  } catch (e: any) {
    console.warn(`[migrate] ${label}:`, e?.message)
  }
}

export async function runMigrations() {
  if (migrated) return
  if (!migratePromise) {
    migratePromise = (async () => {
      // OG 预览缓存表
      await createTable(
        `CREATE TABLE IF NOT EXISTS OgCache (
          url TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`,
        'OgCache'
      )
      await addColumn('SiteConfig', 'navItems', `TEXT NOT NULL DEFAULT '[{"label":"首页","href":"/","icon":"home"},{"label":"归档","href":"/archive","icon":"archive"},{"label":"标签","href":"/tags","icon":"tag"},{"label":"关于","href":"/about","icon":"user"}]'`, 'navItems')
      await addColumn('SiteConfig', 'siteLogo', `TEXT NOT NULL DEFAULT '{"type":"text","value":"✕"}'`, 'siteLogo')
      await addColumn('SiteConfig', 'siteIcon', `TEXT NOT NULL DEFAULT ''`, 'siteIcon')
      await addColumn('SiteConfig', 'showCommentIp', `INTEGER NOT NULL DEFAULT 0`, 'showCommentIp')
      await addColumn('SiteConfig', 'visitorGeoMode', `TEXT NOT NULL DEFAULT 'ip9'`, 'visitorGeoMode')
      await addColumn('SiteConfig', 'visitorGeoKey', `TEXT NOT NULL DEFAULT ''`, 'visitorGeoKey')
      await addColumn('SiteConfig', 'visitorGeoEndpoint', `TEXT NOT NULL DEFAULT ''`, 'visitorGeoEndpoint')
      await addColumn('SiteConfig', 'visitorMapSource', `TEXT NOT NULL DEFAULT 'carto_positron'`, 'visitorMapSource')
      await addColumn('SiteConfig', 'visitorStatsDisplay', `TEXT NOT NULL DEFAULT '["总访问","今日访问","7 日访问","14 日访问","国家数","精确坐标","国家/省份落点","最近时间"]'`, 'visitorStatsDisplay')
      await addColumn('SiteConfig', 'rightPanelWidgets', `TEXT NOT NULL DEFAULT '[{"type":"search","enabled":true},{"type":"about","enabled":true},{"type":"tags","enabled":true},{"type":"hotPosts","enabled":true}]'`, 'rightPanelWidgets')
      await addColumn('SiteConfig', 'enableAiDetection', `INTEGER NOT NULL DEFAULT 1`, 'enableAiDetection (AI 垃圾评论检测)')
      await addColumn('SiteConfig', 'openrouterApiKey', `TEXT NOT NULL DEFAULT ''`, 'openrouterApiKey')
      await addColumn('SiteConfig', 'openrouterModel', `TEXT NOT NULL DEFAULT 'claude-3.5-sonnet'`, 'openrouterModel')
      await addColumn('SiteConfig', 'aiReviewStrength', `TEXT NOT NULL DEFAULT 'balanced'`, 'aiReviewStrength (AI 评审强度)')
      await addColumn('SiteConfig', 'aiAutoApprove', `INTEGER NOT NULL DEFAULT 1`, 'aiAutoApprove (AI 自动通过)')

      await addColumn('Comment', 'ip', `TEXT NOT NULL DEFAULT ''`, 'comment ip')
      await addColumn('Comment', 'guestName', 'TEXT', 'guestName')
      await addColumn('Comment', 'guestEmail', 'TEXT', 'guestEmail')
      await addColumn('Comment', 'guestWebsite', 'TEXT', 'guestWebsite')
      await addColumn('Comment', 'riskScore', 'INTEGER NOT NULL DEFAULT 0', 'comment riskScore (AI 检测)')
      await addColumn('Comment', 'riskReasons', `TEXT NOT NULL DEFAULT '[]'`, 'comment riskReasons (AI 风险原因)')
      await addColumn('Post', 'pinned', 'INTEGER NOT NULL DEFAULT 0', 'post pinned')
      await addColumn('User', 'displayName', `TEXT NOT NULL DEFAULT ''`, 'displayName')
      await addColumn('SiteConfig', 'copyright', `TEXT NOT NULL DEFAULT ''`, 'copyright')
      await addColumn('SiteConfig', 'defaultTheme', `TEXT NOT NULL DEFAULT 'dark'`, 'defaultTheme')
      await addColumn('SiteConfig', 'customDomain', `TEXT NOT NULL DEFAULT ''`, 'customDomain')
      await addColumn('Visitor', 'visitDay', `TEXT NOT NULL DEFAULT ''`, 'visitor visitDay')
      await createTable(
        `CREATE TABLE IF NOT EXISTS Visitor (
          id TEXT PRIMARY KEY,
          ip TEXT NOT NULL,
          path TEXT NOT NULL,
          userAgent TEXT NOT NULL DEFAULT '',
          referrer TEXT NOT NULL DEFAULT '',
          country TEXT NOT NULL DEFAULT '',
          countryCode TEXT NOT NULL DEFAULT '',
          region TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          lat REAL,
          lon REAL,
          visitDay TEXT NOT NULL DEFAULT '',
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'Visitor'
      )
      await createIndex('Visitor', 'idx_visitor_visitDay_createdAt', 'visitDay, createdAt', 'Visitor visitDay index')
      await createIndex('Visitor', 'idx_visitor_ip_createdAt', 'ip, createdAt', 'Visitor ip/createdAt index')
      await createIndex('Visitor', 'idx_visitor_countryCode_createdAt', 'countryCode, createdAt', 'Visitor countryCode/createdAt index')
      await createTable(
        `CREATE TABLE IF NOT EXISTS VisitorGeoCache (
          ip TEXT PRIMARY KEY,
          country TEXT NOT NULL DEFAULT '',
          countryCode TEXT NOT NULL DEFAULT '',
          region TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          lat REAL,
          lon REAL,
          updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'VisitorGeoCache'
      )
      // authorId 改为可空（访客评论）— SQLite 不支持 ALTER COLUMN，新数据已可为 null

      // 登录限流持久化表
      await createTable(
        `CREATE TABLE IF NOT EXISTS LoginFailure (
          ip TEXT PRIMARY KEY,
          count INTEGER NOT NULL DEFAULT 0,
          lockedUntil INTEGER NOT NULL DEFAULT 0,
          updatedAt INTEGER NOT NULL DEFAULT 0
        )`,
        'LoginFailure'
      )
      await createTable(
        `CREATE TABLE IF NOT EXISTS AdminAuditLog (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          targetType TEXT,
          targetId TEXT,
          riskLevel TEXT NOT NULL DEFAULT 'high',
          status TEXT NOT NULL DEFAULT 'success',
          actorId TEXT NOT NULL DEFAULT '',
          actorUsername TEXT NOT NULL DEFAULT '',
          ip TEXT NOT NULL DEFAULT '',
          metadata TEXT NOT NULL DEFAULT '',
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'AdminAuditLog'
      )
      await createIndex('AdminAuditLog', 'idx_admin_audit_createdAt', 'createdAt', 'AdminAuditLog createdAt index')
      await createIndex('AdminAuditLog', 'idx_admin_audit_risk_status_createdAt', 'riskLevel, status, createdAt', 'AdminAuditLog risk/status/createdAt index')
      migrated = true

    })().finally(() => {
      migratePromise = null
    })
  }

  await migratePromise
}
