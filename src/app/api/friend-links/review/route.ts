import { NextRequest, NextResponse } from 'next/server'
import { reviewFriendLinkById } from '@/lib/friend-link-review'

export async function POST(request: NextRequest) {
  try {
    const { linkId } = await request.json()
    const reviewResult = await reviewFriendLinkById(linkId)
    return NextResponse.json(reviewResult)
  } catch (error) {
    console.error('Friend link AI review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审核失败' },
      { status: 500 }
    )
  }
}
