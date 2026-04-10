import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { buildSlugCandidates } from '@/lib/slug'

export async function GET(req: NextRequest) {
  await runMigrations()
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
  const slugCandidates = buildSlugCandidates(slug)

  const post = await prisma.post.findFirst({
    where: { slug: { in: slugCandidates }, published: true },
    select: {
      title: true,
      slug: true,
      publicId: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      author: { select: { username: true, displayName: true, avatar: true } },
    },
  })

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(post, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  })
}
