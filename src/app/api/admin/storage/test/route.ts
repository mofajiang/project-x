import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getStorageProvider, getStorageStatus } from '@/lib/storage'
import { getErrorMessage } from '@/lib/converters';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getStorageStatus()

  if (status.activeDriver === 'smms') {
    return NextResponse.json({
      ok: true,
      message: 'SM.MS 模式可用（该模式不支持无痕读写测试）',
      status,
    })
  }

  const storage = await getStorageProvider()
  const testName = `__healthcheck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let savedName = ''

  try {
    const saved = await storage.saveFile({
      buffer: Buffer.from('storage health check'),
      originalName: 'healthcheck.txt',
      fixedName: testName,
      overwrite: true,
      ensureUnique: false,
    })
    savedName = saved.name

    if (status.capabilities.download) {
      await storage.readFile(savedName)
    }

    if (status.capabilities.delete) {
      await storage.deleteFile(savedName)
      savedName = ''
    }

    return NextResponse.json({
      ok: true,
      message: '存储连接测试通过',
      status,
    })
  } catch (error: unknown) {
    if (savedName && status.capabilities.delete) {
      try {
        await storage.deleteFile(savedName)
      } catch {}
    }
    return NextResponse.json({ error: getErrorMessage(error) || '存储连接测试失败', status }, { status: 500 })
  }
}
