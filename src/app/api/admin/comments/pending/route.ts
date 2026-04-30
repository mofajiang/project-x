import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ count: 0 }, { status: 401 })

  const count = await prisma.comment.count({ where: { approved: false } })
  return NextResponse.json({ count })
}
