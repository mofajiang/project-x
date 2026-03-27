import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/blog.db')

const db = new Database(dbPath)

try {
  db.exec(`ALTER TABLE SiteConfig ADD COLUMN navItems TEXT NOT NULL DEFAULT '[{"label":"首页","href":"/","icon":"home"},{"label":"归档","href":"/archive","icon":"archive"},{"label":"标签","href":"/tags","icon":"tag"},{"label":"关于","href":"/about","icon":"user"}]'`)
  console.log('✅ navItems 列添加成功')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('ℹ️ 列已存在，跳过')
  } else {
    console.error('❌ 错误:', e.message)
  }
}

db.close()
