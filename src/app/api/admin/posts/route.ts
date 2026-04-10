import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { revalidateTag } from 'next/cache'
import { syslog } from '@/lib/syslog'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'all' // all | published | draft

  const where: Record<string, unknown> = {}
  if (search) where.title = { contains: search }
  if (status === 'published') where.published = true
  if (status === 'draft') where.published = false

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.post.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, excerpt, coverImage, published, tags, publishedAt, threadId, threadOrder } = await req.json()
  const slug = slugify(title) + '-' + Date.now()

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || '',
      coverImage,
      published: published || false,
      publishedAt: published ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      authorId: session.userId,
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
  // 保存 threadId / threadOrder（raw SQL）
  if (threadId?.trim()) {
    await prisma.$executeRawUnsafe(
      `UPDATE Post SET threadId = ?, threadOrder = ? WHERE id = ?`,
      threadId.trim(),
      typeof threadOrder === 'number' ? threadOrder : 1,
      post.id
    )
  }
  syslog
    .info('post', `文章${published ? '发布' : '保存为草稿'}: ${title}`, { postId: post.id, slug: post.slug })
    .catch(() => {})
  return NextResponse.json(post)
}
