import { NextRequest, NextResponse } from 'next/server'
import { checkLicense } from '@/lib/license'

// 仅供 middleware 内部调用，不对外暴露
export async function GET(req: NextRequest) {
  // 防止外部直接调用
  const internalHeader = req.headers.get('x-internal-call')
  if (internalHeader !== '1') {
    return NextResponse.json({ valid: false }, { status: 403 })
  }
  const host = req.nextUrl.searchParams.get('host') || ''
  if (!host) return NextResponse.json({ valid: false })
  const valid = await checkLicense(host)
  return NextResponse.json({ valid })
}
