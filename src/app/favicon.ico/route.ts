import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getSiteConfig } from '@/lib/config'

const MIME_BY_EXT: Record<string, string> = {
  ico: 'image/x-icon',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

function getExt(input: string) {
  const cleaned = input.split('?')[0]
  const idx = cleaned.lastIndexOf('.')
  if (idx < 0) return ''
  return cleaned.slice(idx + 1).toLowerCase()
}

function withCacheHeaders(contentType: string) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }
}

export async function GET(req: NextRequest) {
  const config = await getSiteConfig()
  const iconSrc = String(config.siteIcon || '').trim()

  if (!iconSrc) {
    return NextResponse.redirect(new URL('/default-avatar.png', req.url), { status: 302 })
  }

  if (/^https?:\/\//i.test(iconSrc)) {
    try {
      const r = await fetch(iconSrc)
      if (!r.ok) throw new Error(`status ${r.status}`)
      const bytes = await r.arrayBuffer()
      const ext = getExt(iconSrc)
      const contentType = r.headers.get('content-type') || MIME_BY_EXT[ext] || 'image/png'
      return new NextResponse(bytes, { headers: withCacheHeaders(contentType) })
    } catch {
      return NextResponse.redirect(new URL('/default-avatar.png', req.url), { status: 302 })
    }
  }

  const rel = iconSrc.startsWith('/') ? iconSrc.slice(1) : iconSrc
  const abs = path.join(process.cwd(), 'public', rel)
  try {
    const file = await readFile(abs)
    const ext = getExt(iconSrc)
    const contentType = MIME_BY_EXT[ext] || 'image/png'
    return new NextResponse(file, { headers: withCacheHeaders(contentType) })
  } catch {
    return NextResponse.redirect(new URL('/default-avatar.png', req.url), { status: 302 })
  }
}
