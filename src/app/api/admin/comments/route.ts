import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { sendCommentApprovedNotification, sendReplyNotification } from '@/lib/mailer'
import { runMigrations } from '@/lib/db-migrate'
import { getSiteConfig } from '@/lib/config'
import { revalidateTag } from 'next/cache'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await runMigrations()

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') || '20'))
  const search = searchParams.get('search')?.trim() || ''
  const filter = searchParams.get('filter') || 'all'

  const where: any = {}
  if (filter === 'pending') where.approved = false
  if (filter === 'approved') where.approved = true
  if (search) {
    where.OR = [
      { content: { contains: search } },
      { guestName: { contains: search } },
      { ip: { contains: search } },
    ]
  }

  const [comments, total, pendingCount] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { username: true } },
        post: { select: { title: true, slug: true } },
      },
    }),
    prisma.comment.count({ where }),
    prisma.comment.count({ where: { approved: false } }),
  ])

  return NextResponse.json({
    comments,
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
  await runMigrations()
  const { id, approved } = await req.json()

  // 查出完整评论信息用于发邮件（guestEmail 为动态迁移列，用 raw 查询）
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.id, c.content, c.guestName, c.guestEmail, c.ip, c.parentId,
            p.title as postTitle, p.slug as postSlug,
            par.guestEmail as parentGuestEmail, par.guestName as parentGuestName,
            u.email as parentUserEmail, u.username as parentUsername
     FROM Comment c
     JOIN Post p ON p.id = c.postId
     LEFT JOIN Comment par ON par.id = c.parentId
     LEFT JOIN User u ON u.id = par.authorId
     WHERE c.id = ?`, id
  )
  const before = rows[0] ? {
    content: rows[0].content,
    guestName: rows[0].guestName,
    guestEmail: rows[0].guestEmail,
    ip: rows[0].ip,
    post: { title: rows[0].postTitle, slug: rows[0].postSlug },
    parent: rows[0].parentId ? {
      guestEmail: rows[0].parentGuestEmail,
      guestName: rows[0].parentGuestName,
      author: rows[0].parentUserEmail ? { email: rows[0].parentUserEmail, username: rows[0].parentUsername } : null,
    } : null,
  } : null

  const comment = await prisma.comment.update({ where: { id }, data: { approved } })
  revalidateTag('comments')

  // 审核通过后发邮件通知
  if (approved && before) {
    const postUrl = `${baseUrl}/post/${before.post.slug}`
    const postTitle = before.post.title
    const emailConfig = await getSiteConfig().catch(() => null)

    // 1. 通知评论者本人（访客有邮箱时）
    const guestEmail = (before as any).guestEmail
    const guestName = (before as any).guestName || '访客'
    if (guestEmail) {
      sendCommentApprovedNotification({ toEmail: guestEmail, toName: guestName, postTitle, postUrl, content: before.content, customSubject: emailConfig?.emailSubjectApproved || undefined, senderName: emailConfig?.emailSenderName || undefined }).catch(() => {})
    }

    // 2. 如果是回复，通知被回复者
    if (before.parent) {
      const parentEmail = before.parent.guestEmail || before.parent.author?.email
      const parentName = before.parent.guestName || before.parent.author?.username || '用户'
      const replierName = (before as any).guestName || '用户'
      if (parentEmail && parentEmail !== guestEmail) {
        sendReplyNotification({ toEmail: parentEmail, toName: parentName, replierName, postTitle, postUrl, replyContent: before.content, customSubject: emailConfig?.emailSubjectReply || undefined, senderName: emailConfig?.emailSenderName || undefined }).catch(() => {})
      }
    }
  }

  return NextResponse.json(comment)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await runMigrations()
  const { id } = await req.json()
  await prisma.comment.delete({ where: { id } })
  revalidateTag('comments')
  return NextResponse.json({ ok: true })
}
