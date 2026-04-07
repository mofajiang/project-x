import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { mkdir, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 50 * 1024 * 1024
const ALLOWED_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico',
  'pdf', 'txt', 'md', 'json', 'csv',
  'mp4', 'mp3', 'wav',
  'zip', 'rar', '7z',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
])

function safeBaseName(input: string) {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') return ''
  return cleaned
}

function extOf(filename: string) {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : ''
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true })
}

async function nextAvailableName(name: string) {
  const ext = extOf(name)
  const base = ext ? name.slice(0, -1 * (ext.length + 1)) : name
  let candidate = name
  let index = 1
  while (true) {
    try {
      await stat(path.join(UPLOAD_DIR, candidate))
      candidate = ext ? `${base}-${index}.${ext}` : `${base}-${index}`
      index += 1
    } catch {
      return candidate
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureUploadDir()
  const names = await readdir(UPLOAD_DIR)
  const rows = await Promise.all(names.map(async (name) => {
    const st = await stat(path.join(UPLOAD_DIR, name))
    return {
      name,
      size: st.size,
      updatedAt: st.mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(name)}`,
      ext: extOf(name),
    }
  }))

  rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return NextResponse.json({ files: rows })
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

  await ensureUploadDir()

  let targetName = ''
  if (customNameRaw) {
    const cleaned = safeBaseName(customNameRaw)
    if (!cleaned) return NextResponse.json({ error: '文件名不合法' }, { status: 400 })
    const customExt = extOf(cleaned)
    targetName = customExt ? cleaned : `${cleaned}.${originalExt}`
  } else {
    const base = safeBaseName(file.name.replace(/\.[^.]+$/, '')) || `${Date.now()}`
    targetName = `${base}.${originalExt}`
  }

  targetName = await nextAvailableName(targetName)

  const bytes = await file.arrayBuffer()
  await writeFile(path.join(UPLOAD_DIR, targetName), Buffer.from(bytes))

  return NextResponse.json({
    ok: true,
    file: {
      name: targetName,
      url: `/uploads/${encodeURIComponent(targetName)}`,
      ext: extOf(targetName),
      size: file.size,
    },
  })
}
