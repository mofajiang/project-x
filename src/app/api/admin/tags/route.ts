import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { slugify } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { posts: { _count: 'desc' } },
  })
  return NextResponse.json(tags, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } })
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await prisma.tag.delete({ where: { id } })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  const trimmedName = String(name || '').trim()
  if (!trimmedName) {
    return NextResponse.json({ error: '标签名不能为空' }, { status: 400 })
  }

  const slug = slugify(trimmedName)
  if (!slug) {
    return NextResponse.json({ error: '标签名无效' }, { status: 400 })
  }

  const tag = await prisma.tag.upsert({
    where: { slug },
    update: { name: trimmedName },
    create: { name: trimmedName, slug },
    include: { _count: { select: { posts: true } } },
  })

  return NextResponse.json(tag, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } })
}
