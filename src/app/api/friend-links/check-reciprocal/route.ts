import { NextRequest, NextResponse } from 'next/server'
import { checkFriendLinkOnTargetSite } from '@/lib/friend-link-checker'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 })
    }

    const myDomain = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname

    const result = await checkFriendLinkOnTargetSite(url, myDomain)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Check Reciprocal Error]', error)
    return NextResponse.json(
      { found: false, error: '检查失败' },
      { status: 500 }
    )
  }
}
