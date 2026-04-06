import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { checkFriendLinkOnTargetSite } from '@/lib/friend-link-checker'

/**
 * 后台：获取待审核的友链列表
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))

    const [links, total] = await Promise.all([
      prisma.friendLink.findMany({
        where: status !== 'all' ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.friendLink.count({
        where: status !== 'all' ? { status } : undefined,
      }),
    ])

    return NextResponse.json({
      links,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[Admin FriendLinks Error]', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

/**
 * 后台：批准或拒绝友链
 */
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const { action, rejectionReason } = await req.json()

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 })
    }

    if (action === 'approve') {
      const link = await prisma.friendLink.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
        },
      })
      return NextResponse.json({
        message: '已批准',
        link,
      })
    } else if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json(
          { error: '请提供拒绝原因' },
          { status: 400 }
        )
      }

      const link = await prisma.friendLink.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason,
        },
      })
      return NextResponse.json({
        message: '已拒绝',
        link,
      })
    } else if (action === 'recheck-reciprocal') {
      // 重新检查互链
      const link = await prisma.friendLink.findUnique({ where: { id } })
      if (!link) {
        return NextResponse.json({ error: '链接不存在' }, { status: 404 })
      }

      const myDomain = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname
      const result = await checkFriendLinkOnTargetSite(link.url, myDomain)

      const updated = await prisma.friendLink.update({
        where: { id },
        data: {
          hasReciprocal: result.found,
          reciprocalChecked: true,
          reciprocalCheckTime: new Date(),
        },
      })

      return NextResponse.json({
        message: result.found ? '已检测到互链' : '未检测到互链',
        hasReciprocal: result.found,
        link: updated,
      })
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 })
  } catch (error) {
    console.error('[Admin FriendLinks Update Error]', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}

/**
 * 后台：删除友链
 */
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 })
    }

    await prisma.friendLink.delete({ where: { id } })

    return NextResponse.json({ message: '已删除' })
  } catch (error) {
    console.error('[Admin FriendLinks Delete Error]', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
