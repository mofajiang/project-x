import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getStorageProvider, safeName } from '@/lib/storage'
import { getErrorMessage } from '@/lib/converters'

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

  const storage = await getStorageProvider()
  try {
    const { data, ext } = await storage.readFile(safe)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeByExt(ext),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`,
      },
    })
  } catch {
    return NextResponse.json({ error: '文件不存在或当前存储不支持下载' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oldName = safeName(params.name)
  if (!oldName) return NextResponse.json({ error: '原文件名无效' }, { status: 400 })

  const body = await req.json()
  const nextRaw = String(body?.newName || '').trim()
  const nextName = safeName(nextRaw)
  if (!nextName) return NextResponse.json({ error: '新文件名无效' }, { status: 400 })

  const storage = await getStorageProvider()
  let file
  try {
    file = await storage.renameFile(oldName, nextName)
  } catch (error: unknown) {
    if (getErrorMessage(error) === 'NOT_SUPPORTED') {
      return NextResponse.json({ error: '当前存储不支持重命名' }, { status: 400 })
    }
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: '原文件不存在' }, { status: 404 })
    }
    if (getErrorMessage(error) === 'FILE_EXISTS') {
      return NextResponse.json({ error: '新文件名已存在' }, { status: 400 })
    }
    return NextResponse.json({ error: '重命名失败' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    file,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safe = safeName(params.name)
  if (!safe) return NextResponse.json({ error: '文件名无效' }, { status: 400 })

  const storage = await getStorageProvider()
  try {
    await storage.deleteFile(safe)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (getErrorMessage(error) === 'NOT_SUPPORTED') {
      return NextResponse.json({ error: '当前存储不支持删除' }, { status: 400 })
    }
    return NextResponse.json({ error: '删除失败或文件不存在' }, { status: 404 })
  }
}
