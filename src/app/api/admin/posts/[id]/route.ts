import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'
import { slugify } from '@/lib/utils'


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { tags: { include: { tag: true } } },
  })
  return NextResponse.json(post)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, excerpt, coverImage, published, tags, publishedAt, pinned } = await req.json()

  // 先删旧标签关联
  await prisma.tagsOnPosts.deleteMany({ where: { postId: params.id } })

  const post = await prisma.post.update({
    where: { id: params.id },
    data: {
      title,
      content,
      excerpt: excerpt || '',
      coverImage,
      published,
      publishedAt: published ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      pinned: pinned ?? false,
      tags: {
        create: (tags || []).map((tagName: string) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tagName) },
              create: { name: tagName, slug: slugify(tagName) },
            },
          },
        })),
      },
    },
  })
  return NextResponse.json(post)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pinned } = await req.json()

  const post = await prisma.post.update({
    where: { id: params.id },
    data: { pinned: typeof pinned === 'boolean' ? pinned : undefined },
    include: { tags: { include: { tag: true } } },
  })
  return NextResponse.json(post)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestIp = getRequestIp(req)
  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, title: true } })

  if (!post) {
    await logAdminAudit({
      action: 'post.deleted',
      summary: '删除文章失败：文章不存在',
      riskLevel: 'high',
      status: 'failed',
      targetType: 'post',
      targetId: params.id,
      actor: session,
      ip: requestIp,
    })
    return NextResponse.json({ error: '文章不存在' }, { status: 404 })
  }

  await prisma.post.delete({ where: { id: params.id } })
  await logAdminAudit({
    action: 'post.deleted',
    summary: `删除文章《${post.title}》`,
    riskLevel: 'high',
    targetType: 'post',
    targetId: post.id,
    actor: session,
    ip: requestIp,
  })
  return NextResponse.json({ ok: true })
}

