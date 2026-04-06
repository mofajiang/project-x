import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function buildSlugCandidates(input: string) {
  const set = new Set<string>()
  const raw = (input || '').trim()
  if (!raw) return []

  set.add(raw)
  try {
    set.add(decodeURIComponent(raw))
  } catch {}
  try {
    set.add(encodeURIComponent(raw))
  } catch {}

  for (const value of Array.from(set)) {
    set.add(value.normalize('NFC'))
    set.add(value.normalize('NFD'))
  }

  return Array.from(set).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
  const slugCandidates = buildSlugCandidates(slug)

  const post = await prisma.post.findFirst({
    where: { slug: { in: slugCandidates }, published: true },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      author: { select: { username: true, avatar: true } },
    },
  })

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(post)
}
