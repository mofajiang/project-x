import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { extOf, getStorageProvider } from '@/lib/storage'

const MAX_SIZE = 50 * 1024 * 1024
const ALLOWED_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico',
  'pdf', 'txt', 'md', 'json', 'csv',
  'mp4', 'mp3', 'wav',
  'zip', 'rar', '7z',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
])

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storage = await getStorageProvider()
  let files
  try {
    files = await storage.listFiles()
  } catch (error: any) {
    if (error?.message === 'NOT_SUPPORTED') {
      return NextResponse.json({ error: '当前存储不支持文件列表，请在存储设置切换到本地或 S3。' }, { status: 400 })
    }
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 })
  }
  return NextResponse.json({ files })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const customNameRaw = String(form.get('fileName') || '').trim()
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件不能超过 50MB' }, { status: 400 })
  }

  const originalExt = extOf(file.name)
  if (!originalExt || !ALLOWED_EXTS.has(originalExt)) {
    return NextResponse.json({ error: '文件类型不支持' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const storage = await getStorageProvider()
  let saved
  try {
    saved = await storage.saveFile({
      buffer: Buffer.from(bytes),
      originalName: file.name,
      fileName: customNameRaw || undefined,
      ensureUnique: true,
    })
  } catch (error: any) {
    if (error?.message === 'INVALID_NAME') {
      return NextResponse.json({ error: '文件名不合法' }, { status: 400 })
    }
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    file: saved,
  })
}
