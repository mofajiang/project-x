import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { runMigrations } from '@/lib/db-migrate'
import { slugify } from '@/lib/utils'
import { revalidateTag } from 'next/cache'

/**
 * POST /api/posts/[id]/repost
 * 为已登录用户创建一条转发帖子（内容为原帖内嵌引用），并增加原帖转发计数。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await runMigrations()

  const originalPost = await prisma.post.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, title: true, published: true },
  })

  if (!originalPost || !originalPost.published) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // 内容格式：::quote[slug]（与站内引用一致）
  const content = `::quote[${originalPost.slug}]`
  const postTitle = `转发：${originalPost.title}`.slice(0, 100)
  const slug = `repost-${slugify(originalPost.title)}-${Date.now()}`

  const rows = await prisma.$queryRawUnsafe<{ nextId: number }[]>(
    `SELECT COALESCE(MAX(publicId), 0) + 1 as nextId FROM Post`
  )
  const publicId = Number(rows[0]?.nextId) || 1

  const newPost = await prisma.post.create({
    data: {
      publicId,
      title: postTitle,
      slug,
      content,
      excerpt: '转发了帖子',
      published: true,
      publishedAt: new Date(),
      authorId: session.userId,
    },
  })

  // 增加原帖转发计数（raw SQL，reposts 是动态迁移列）
  await prisma.$executeRawUnsafe(`UPDATE Post SET reposts = COALESCE(reposts, 0) + 1 WHERE id = ?`, originalPost.id)

  revalidateTag('posts')

  return NextResponse.json({
    success: true,
    post: { id: newPost.id, publicId: newPost.publicId, slug: newPost.slug },
  })
}
