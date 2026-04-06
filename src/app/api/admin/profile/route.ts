import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, username, displayName, email, avatar, bio FROM User WHERE id = ?`, session.userId
  )
  return NextResponse.json(rows[0] ?? null, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, displayName, avatar, bio } = await req.json()

  // 检查用户名是否被占用
  if (username) {
    const existing = await prisma.user.findFirst({
      where: { username, NOT: { id: session.userId } },
    })
    if (existing) {
      return NextResponse.json({ error: '用户名已被占用' }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(username ? { username } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
      ...(bio !== undefined ? { bio } : {}),
    },
  })
  // displayName 通过 raw SQL 更新（Prisma client 版本兼容）
  if (displayName !== undefined) {
    await prisma.$executeRawUnsafe(`UPDATE User SET displayName = ? WHERE id = ?`, displayName ?? '', session.userId)
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, username, displayName, email, avatar, bio FROM User WHERE id = ?`, session.userId
  )
  return NextResponse.json(rows[0] ?? null, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } })
}
