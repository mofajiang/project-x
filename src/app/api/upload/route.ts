import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getStorageProvider } from '@/lib/storage'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const fixedNameRaw = formData.get('fixedName')
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // 文件类型白名单校验
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ]
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'ico']
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: '仅支持图片文件（JPG/PNG/GIF/WebP/SVG/ICO）' }, { status: 400 })
  }
  // 文件大小限制 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const fixedName =
    typeof fixedNameRaw === 'string'
      ? fixedNameRaw
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '')
      : ''

  const storage = await getStorageProvider()
  try {
    const saved = await storage.saveFile({
      buffer,
      originalName: file.name,
      fileName: fixedName ? undefined : `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
      fixedName: fixedName || undefined,
      ensureUnique: !fixedName,
      overwrite: !!fixedName,
    })
    return NextResponse.json({ url: saved.url })
  } catch {
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
