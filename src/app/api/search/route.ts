import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'

export async function GET(req: NextRequest) {
  await runMigrations()
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  // 先搜标题和摘要（索引友好），不够再加全文
  let posts = await prisma.post.findMany({
    where: {
      published: true,
      OR: [{ title: { contains: q } }, { excerpt: { contains: q } }],
    },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      publicId: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      author: { select: { username: true } },
    },
  })

  // 标题/摘要不够 20 条时补充全文搜索
  if (posts.length < 20) {
    const existingIds = new Set(posts.map((p) => p.id))
    const contentPosts = await prisma.post.findMany({
      where: {
        published: true,
        id: { notIn: Array.from(existingIds) },
        content: { contains: q },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20 - posts.length,
      select: {
        id: true,
        publicId: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        author: { select: { username: true } },
      },
    })
    posts = [...posts, ...contentPosts]
  }

  return NextResponse.json(posts, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
