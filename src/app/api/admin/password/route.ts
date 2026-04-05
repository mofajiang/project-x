import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'
import bcrypt from 'bcryptjs'


export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestIp = getRequestIp(req)
  const { oldPassword, newPassword } = await req.json()
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: '密码至少8位' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    await logAdminAudit({
      action: 'password.changed',
      summary: '修改管理员密码失败：未找到当前用户',
      riskLevel: 'critical',
      status: 'failed',
      targetType: 'user',
      targetId: session.userId,
      actor: session,
      ip: requestIp,
    })
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const valid = await bcrypt.compare(oldPassword, user.password)
  if (!valid) {
    await logAdminAudit({
      action: 'password.changed',
      summary: '修改管理员密码失败：旧密码校验未通过',
      riskLevel: 'critical',
      status: 'failed',
      targetType: 'user',
      targetId: user.id,
      actor: session,
      ip: requestIp,
    })
    return NextResponse.json({ error: '旧密码错误' }, { status: 401 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
  await logAdminAudit({
    action: 'password.changed',
    summary: '修改管理员密码',
    riskLevel: 'critical',
    targetType: 'user',
    targetId: user.id,
    actor: session,
    ip: requestIp,
  })

  return NextResponse.json({ ok: true })
}

