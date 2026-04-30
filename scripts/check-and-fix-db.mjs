import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const Database = require(join(__dirname, '../node_modules/better-sqlite3'))
  const dbPath = join(__dirname, '../data/blog.db')
  const db = new Database(dbPath)

  // 查看当前列
  const cols = db.prepare('PRAGMA table_info(SiteConfig)').all()
  console.log('当前列:', cols.map(c => c.name).join(', '))

  const colNames = cols.map(c => c.name)

  if (!colNames.includes('navItems')) {
    db.exec(`ALTER TABLE SiteConfig ADD COLUMN navItems TEXT NOT NULL DEFAULT '[{"label":"首页","href":"/","icon":"home"},{"label":"归档","href":"/archive","icon":"archive"},{"label":"标签","href":"/tags","icon":"tag"},{"label":"关于","href":"/about","icon":"user"}]'`)
    console.log('✅ navItems 列添加成功')
  } else {
    console.log('ℹ️  navItems 列已存在')
  }

  if (!colNames.includes('siteIcon')) {
    db.exec(`ALTER TABLE SiteConfig ADD COLUMN siteIcon TEXT NOT NULL DEFAULT ''`)
    console.log('✅ siteIcon 列添加成功')
  } else {
    console.log('ℹ️  siteIcon 列已存在')
  }

  // 验证
  const row = db.prepare('SELECT * FROM SiteConfig WHERE id = ?').get('singleton')
  console.log('\n当前配置:', JSON.stringify(row, null, 2))

  db.close()
  console.log('\n✅ 数据库检查完成')
} catch (e) {
  console.error('❌ 错误:', e.message)
  process.exit(1)
}
