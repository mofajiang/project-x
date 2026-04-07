import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const fixedNameRaw = formData.get('fixedName')
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // 文件类型白名单校验
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
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

  const fixedName = typeof fixedNameRaw === 'string'
    ? fixedNameRaw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')
    : ''
  const filename = fixedName
    ? `${fixedName}.${ext}`
    : `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')

  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
