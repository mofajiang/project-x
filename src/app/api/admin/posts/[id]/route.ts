import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
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

  const { title, content, excerpt, coverImage, published, tags, publishedAt } = await req.json()

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.post.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
