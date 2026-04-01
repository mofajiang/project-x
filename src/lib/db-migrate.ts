/**
 * 自动数据库迁移 — 在应用首次启动时补充缺失的列
 * 无需手动执行 prisma db push
 */
import { prisma } from './prisma'

let migrated = false

async function addColumn(table: string, column: string, definition: string, label: string) {
  try {
    // 先检查列是否已存在
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM pragma_table_info(?) WHERE name = ?`, table, column
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

export async function runMigrations() {
  if (migrated) return
  migrated = true

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
  await addColumn('SiteConfig', 'rightPanelWidgets', `TEXT NOT NULL DEFAULT '[{"type":"search","enabled":true},{"type":"about","enabled":true},{"type":"tags","enabled":true},{"type":"hotPosts","enabled":true}]'`, 'rightPanelWidgets')
  await addColumn('Comment', 'guestName', 'TEXT', 'guestName')
  await addColumn('Comment', 'guestEmail', 'TEXT', 'guestEmail')
  await addColumn('User', 'displayName', `TEXT NOT NULL DEFAULT ''`, 'displayName')
  await addColumn('SiteConfig', 'copyright', `TEXT NOT NULL DEFAULT ''`, 'copyright')
  await addColumn('SiteConfig', 'defaultTheme', `TEXT NOT NULL DEFAULT 'dark'`, 'defaultTheme')
  await addColumn('SiteConfig', 'customDomain', `TEXT NOT NULL DEFAULT ''`, 'customDomain')
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
}
