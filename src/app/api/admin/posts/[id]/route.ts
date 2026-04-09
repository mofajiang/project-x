import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'
import { slugify } from '@/lib/utils'
import { revalidateTag } from 'next/cache'
import { syslog } from '@/lib/syslog'

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

  // 查询现有文章，判断是否已发布过
  const existingPost = await prisma.post.findUnique({
    where: { id: params.id },
    select: { published: true, publishedAt: true },
  })

  // 先删旧标签关联
  await prisma.tagsOnPosts.deleteMany({ where: { postId: params.id } })

  // 发布时间逻辑：
  // 1. 如果现在要发布且之前未发布过，则设置新的发布时间
  // 2. 如果现在要发布且之前已发布过，则保留原有发布时间（除非显式传入新的）
  // 3. 如果现在取消发布，则设为 null
  let finalPublishedAt: Date | null = null
  if (published) {
    if (existingPost?.published && existingPost?.publishedAt) {
      // 已发布状态：保留原发布时间（除非用户显式修改）
      finalPublishedAt =
        publishedAt && new Date(publishedAt).getTime() !== new Date(existingPost.publishedAt).getTime()
          ? new Date(publishedAt)
          : existingPost.publishedAt
    } else {
      // 未发布状态转发布：使用传入的时间或当前时间
      finalPublishedAt = publishedAt ? new Date(publishedAt) : new Date()
    }
  }

  const post = await prisma.post.update({
    where: { id: params.id },
    data: {
      title,
      content,
      excerpt: excerpt || '',
      coverImage,
      published,
      publishedAt: finalPublishedAt,
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
  revalidateTag('posts')
  syslog.info('post', `文章${published ? '已发布' : '已保存为草稿'}: ${title}`, { postId: params.id }).catch(() => {})
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
  revalidateTag('posts')
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
  revalidateTag('posts')
  return NextResponse.json({ ok: true })
}
