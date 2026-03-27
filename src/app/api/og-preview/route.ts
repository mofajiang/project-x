import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 内存一级缓存（进程内极速响应）
const memCache = new Map<string, { data: OGData; ts: number }>()
const MEM_TTL = 1000 * 60 * 10 // 10分钟内存缓存
const DB_TTL = 1000 * 60 * 60 * 24 * 7 // 7天数据库缓存

interface OGData {
  title: string
  description: string
  image: string
  hostname: string
  url: string
}

function extractMeta(html: string, url: string): OGData {
  const get = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? ''

  const ogTitle = get(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || get(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  const ogDesc = get(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || get(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
  const ogImage = get(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || get(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  const metaTitle = get(/<title[^>]*>([^<]+)<\/title>/i)
  const metaDesc = get(/name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || get(/content=["']([^"']+)["'][^>]*name=["']description["']/i)

  let hostname = ''
  try { hostname = new URL(url).hostname } catch {}

  return {
    title: ogTitle || metaTitle || hostname,
    description: ogDesc || metaDesc || '',
    image: ogImage || '',
    hostname,
    url,
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try { new URL(url) } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  let hostname = ''
  try { hostname = new URL(url).hostname } catch {}

  // 1. 内存缓存（最快）
  const mem = memCache.get(url)
  if (mem && Date.now() - mem.ts < MEM_TTL) {
    return NextResponse.json(mem.data, { headers: { 'X-Cache': 'MEM' } })
  }

  // 2. 数据库缓存
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT data, updatedAt FROM OgCache WHERE url = ? LIMIT 1`, url
    )
    if (rows.length > 0) {
      const age = Date.now() - new Date(rows[0].updatedAt).getTime()
      if (age < DB_TTL) {
        const data = JSON.parse(rows[0].data) as OGData
        memCache.set(url, { data, ts: Date.now() })
        return NextResponse.json(data, { headers: { 'X-Cache': 'DB' } })
      }
    }
  } catch { /* OgCache 表可能未创建，继续 */ }

  // 3. 实时抓取
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)' },
      signal: AbortSignal.timeout(3000),
    })
    const html = await res.text()
    const data = extractMeta(html, url)

    // 写入内存缓存
    memCache.set(url, { data, ts: Date.now() })

    // 写入数据库缓存（非阻塞）
    prisma.$executeRawUnsafe(
      `INSERT INTO OgCache (url, data, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
      url, JSON.stringify(data), new Date().toISOString()
    ).catch(() => {})

    return NextResponse.json(data, { headers: { 'X-Cache': 'FETCH' } })
  } catch {
    const fallback: OGData = { title: hostname || url, description: '', image: '', hostname, url }
    memCache.set(url, { data: fallback, ts: Date.now() })
    return NextResponse.json(fallback)
  }
}
