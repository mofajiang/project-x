import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { runMigrations } from '@/lib/db-migrate'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'


export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestIp = getRequestIp(req)

  try {
    await runMigrations()
    const deleted = await prisma.$executeRaw`DELETE FROM Visitor`
    await logAdminAudit({
      action: 'visitor.logs.cleared',
      summary: `清空访客日志，共删除 ${Number(deleted) || 0} 条记录`,
      riskLevel: 'critical',
      targetType: 'visitor',
      targetId: 'all',
      actor: session,
      ip: requestIp,
      metadata: { deleted: Number(deleted) || 0 },
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (e: any) {
    await logAdminAudit({
      action: 'visitor.logs.cleared',
      summary: '清空访客日志失败',
      riskLevel: 'critical',
      status: 'failed',
      targetType: 'visitor',
      targetId: 'all',
      actor: session,
      ip: requestIp,
      metadata: { error: e?.message || 'unknown error' },
    })
    return NextResponse.json({ error: e?.message || '删除失败' }, { status: 500 })
  }
}
