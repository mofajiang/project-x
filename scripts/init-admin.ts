/**
 * 初始化管理员账号脚本
 * 运行: npx tsx scripts/init-admin.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456'

  const existing = await prisma.user.findFirst({ where: { username } })
  if (existing) {
    console.log(`管理员账号已存在: ${username}`)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { username, email, password: hashed },
  })

  // 初始化站点配置
  await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })

  console.log('✅ 管理员账号已创建:')
  console.log(`   用户名: ${user.username}`)
  console.log(`   邮箱:   ${user.email}`)
  console.log(`   密码:   ${password}`)
  console.log('')
  console.log('⚠️  请登录后台后立即修改密码！')
  console.log('📍 默认登录地址: http://localhost:3000/admin-login')
}

main().catch(console.error).finally(() => prisma.$disconnect())
