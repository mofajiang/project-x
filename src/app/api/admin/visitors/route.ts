import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { runMigrations } from '@/lib/db-migrate'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'
import { getErrorMessage } from '@/lib/converters';


export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestIp = getRequestIp(req)

  try {
    await runMigrations()
    const deletedRaw = await prisma.$executeRaw`DELETE FROM Visitor`
    const deleted = Number(deletedRaw) || 0
    await logAdminAudit({
      action: 'visitor.logs.cleared',
      summary: `清空访客日志，共删除 ${deleted} 条记录`,
      riskLevel: 'critical',
      targetType: 'visitor',
      targetId: 'all',
      actor: session,
      ip: requestIp,
      metadata: { deleted },
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (e: unknown) {
    await logAdminAudit({
      action: 'visitor.logs.cleared',
      summary: '清空访客日志失败',
      riskLevel: 'critical',
      status: 'failed',
      targetType: 'visitor',
      targetId: 'all',
      actor: session,
      ip: requestIp,
      metadata: { error: getErrorMessage(e) || 'unknown error' },
    })
    return NextResponse.json({ error: getErrorMessage(e) || '删除失败' }, { status: 500 })
  }
}
