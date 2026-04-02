import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { runMigrations } from '@/lib/db-migrate'

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await runMigrations()
  const deleted = await prisma.$executeRaw`DELETE FROM Visitor`
  return NextResponse.json({ ok: true, deleted })
}