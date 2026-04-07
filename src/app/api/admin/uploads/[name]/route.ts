import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { rename, rm, stat, readFile } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

function safeName(input: string) {
  const decoded = decodeURIComponent(input || '')
  const cleaned = decoded
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

function mimeByExt(ext: string) {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv',
    mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
    zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return map[ext] || 'application/octet-stream'
}

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safe = safeName(params.name)
  if (!safe) return NextResponse.json({ error: '文件名无效' }, { status: 400 })

  const filePath = path.join(UPLOAD_DIR, safe)
  try {
    const data = await readFile(filePath)
    const ext = extOf(safe)
    return new NextResponse(data, {
      headers: {
        'Content-Type': mimeByExt(ext),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`,
      },
    })
  } catch {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oldName = safeName(params.name)
  if (!oldName) return NextResponse.json({ error: '原文件名无效' }, { status: 400 })

  const body = await req.json()
  const nextRaw = String(body?.newName || '').trim()
  let nextName = safeName(nextRaw)
  if (!nextName) return NextResponse.json({ error: '新文件名无效' }, { status: 400 })

  const oldExt = extOf(oldName)
  const nextExt = extOf(nextName)
  if (!nextExt && oldExt) {
    nextName = `${nextName}.${oldExt}`
  }

  const oldPath = path.join(UPLOAD_DIR, oldName)
  const newPath = path.join(UPLOAD_DIR, nextName)

  try {
    await stat(oldPath)
  } catch {
    return NextResponse.json({ error: '原文件不存在' }, { status: 404 })
  }

  try {
    await stat(newPath)
    return NextResponse.json({ error: '新文件名已存在' }, { status: 400 })
  } catch {}

  await rename(oldPath, newPath)
  return NextResponse.json({
    ok: true,
    file: {
      name: nextName,
      url: `/uploads/${encodeURIComponent(nextName)}`,
    },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safe = safeName(params.name)
  if (!safe) return NextResponse.json({ error: '文件名无效' }, { status: 400 })

  try {
    await rm(path.join(UPLOAD_DIR, safe), { force: false })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '删除失败或文件不存在' }, { status: 404 })
  }
}
