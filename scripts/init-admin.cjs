const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456'

  const existing = await prisma.user.findFirst({ where: { username } })
  if (existing) {
    console.log('✅ 管理员账号已存在: ' + username)
    return
  }

  const hashed = bcrypt.hashSync(password, 12)
  await prisma.user.create({ data: { username, email, password: hashed } })
  await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })

  console.log('✅ 管理员账号已创建:')
  console.log('   用户名: ' + username)
  console.log('   邮箱:   ' + email)
  console.log('   密码:   ' + password)
  console.log('')
  console.log('⚠️  请登录后台后立即修改密码！')
  console.log('📍 默认登录地址: http://localhost:3000/admin-login')
}

main().catch(console.error).finally(() => prisma.$disconnect())
