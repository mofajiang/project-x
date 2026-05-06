import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { syslog } from '@/lib/syslog'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') || '20'))
  const search = searchParams.get('search')?.trim() || ''
  const filter = searchParams.get('filter') || 'all'

  const where: Prisma.GuestbookMessageWhereInput = {}
  if (filter === 'pending') where.approved = false
  if (filter === 'approved') where.approved = true
  if (search) {
    where.OR = [{ content: { contains: search } }, { guestName: { contains: search } }, { ip: { contains: search } }]
  }

  const [messages, total, pendingCount] = await Promise.all([
    prisma.guestbookMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { username: true } },
      },
    }),
    prisma.guestbookMessage.count({ where }),
    prisma.guestbookMessage.count({ where: { approved: false } }),
  ])

  return NextResponse.json({
    messages,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    pendingCount,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, approved } = await req.json()
  const message = await prisma.guestbookMessage.update({ where: { id }, data: { approved } })

  syslog
    .info('guestbook', approved ? `留言已通过审核: ${message.guestName}` : `留言已驳回: ${message.guestName}`, {
      messageId: id,
    })
    .catch(() => {})

  return NextResponse.json(message)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.guestbookMessage.delete({ where: { id } })

  syslog.info('guestbook', `留言已删除: id=${id}`).catch(() => {})
  return NextResponse.json({ ok: true })
}
