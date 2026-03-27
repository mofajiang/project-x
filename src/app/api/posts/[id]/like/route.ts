import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 简单内存防刷：同一 IP 对同一文章 60s 内只能点赞一次
const likeMap = new Map<string, number>()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const key = `${ip}:${params.id}`
  const last = likeMap.get(key) || 0
  if (Date.now() - last < 60_000) {
    return NextResponse.json({ error: '操作过于频繁' }, { status: 429 })
  }
  likeMap.set(key, Date.now())

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { likes: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.post.update({
    where: { id: params.id },
    data: { likes: { increment: 1 } },
  })
  return NextResponse.json({ ok: true, likes: post.likes + 1 })
}
