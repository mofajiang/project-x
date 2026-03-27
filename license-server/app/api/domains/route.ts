import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ADMIN_KEY = process.env.ADMIN_KEY || ''
const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'domains.json')

type DomainEntry = { domain: string; addedAt: string; note?: string }

function readDomains(): DomainEntry[] {
  try {
    if (!existsSync(DB_PATH)) return []
    return JSON.parse(readFileSync(DB_PATH, 'utf8'))
  } catch { return [] }
}

function writeDomains(domains: DomainEntry[]) {
  const { mkdirSync } = require('fs')
  const { dirname } = require('path')
  mkdirSync(dirname(DB_PATH), { recursive: true })
  writeFileSync(DB_PATH, JSON.stringify(domains, null, 2), 'utf8')
}

function checkAdmin(req: NextRequest): boolean {
  if (!ADMIN_KEY) return false
  return req.headers.get('x-admin-key') === ADMIN_KEY
}

// 获取所有授权域名
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(readDomains())
}

// 添加授权域名
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { domain, note } = await req.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })
  const domains = readDomains()
  const d = domain.toLowerCase().trim()
  if (domains.find(x => x.domain === d)) {
    return NextResponse.json({ error: 'Already exists' }, { status: 409 })
  }
  domains.push({ domain: d, addedAt: new Date().toISOString(), note: note || '' })
  writeDomains(domains)
  return NextResponse.json({ success: true })
}

// 删除授权域名
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { domain } = await req.json()
  const domains = readDomains().filter(x => x.domain !== domain.toLowerCase().trim())
  writeDomains(domains)
  return NextResponse.json({ success: true })
}

// 供 verify API 内部调用（不需要 admin key）
export function getAllowedDomains(): string[] {
  return readDomains().map(d => d.domain)
}
