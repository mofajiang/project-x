import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  if (!rateLimit(`like:${ip}:${params.id}`, { max: 1, windowMs: 60_000 })) {
    return NextResponse.json({ error: '操作过于频繁' }, { status: 429 })
  }

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { likes: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.post.update({
    where: { id: params.id },
    data: { likes: { increment: 1 } },
  })
  return NextResponse.json({ ok: true, likes: post.likes + 1 })
}
