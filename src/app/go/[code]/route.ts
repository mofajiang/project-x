import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!code || !/^[0-9A-Za-z]{4,12}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  await runMigrations()
  const rows = await prisma.$queryRawUnsafe<{ url: string }[]>('SELECT url FROM ShortLink WHERE code = ?', code)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // Increment click counter asynchronously
  prisma.$executeRawUnsafe('UPDATE ShortLink SET clicks = clicks + 1 WHERE code = ?', code).catch(() => {})
  return NextResponse.redirect(rows[0].url, 302)
}
