import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { checkFriendLinkOnTargetSite, getFavicon } from '@/lib/friend-link-checker'
import { toSafeNumber, toSafeBoolean, toJsonSafe } from '@/lib/converters'
import { syslog } from '@/lib/syslog'

function normalizeUrl(url: string) {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * 后台：获取待审核的友链列表
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized', links: [], total: 0 }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))

    const offset = (page - 1) * limit
    const [linksRaw, totalRaw] = await Promise.all(
      status !== 'all'
        ? [
            prisma.$queryRawUnsafe<any[]>(
              `SELECT id, name, url, description, favicon, status, rejectionReason,
                      email,
                      COALESCE(hasReciprocal, 0) AS hasReciprocal,
                      COALESCE(reciprocalChecked, 0) AS reciprocalChecked,
                      COALESCE(aiScore, 0) AS aiScore,
                      COALESCE(sortOrder, 0) AS sortOrder,
                      COALESCE(showInSidebar, 1) AS showInSidebar,
                      createdAt
               FROM FriendLink
               WHERE status = ?
               ORDER BY COALESCE(sortOrder, 0) DESC,
                        CASE
                          WHEN typeof(createdAt) = 'integer' THEN createdAt
                          ELSE CAST(strftime('%s', createdAt) AS INTEGER) * 1000
                        END DESC
               LIMIT ? OFFSET ?`,
              status,
              limit,
              offset
            ),
            prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS total FROM FriendLink WHERE status = ?`, status),
          ]
        : [
            prisma.$queryRawUnsafe<any[]>(
              `SELECT id, name, url, description, favicon, status, rejectionReason,
                      email,
                      COALESCE(hasReciprocal, 0) AS hasReciprocal,
                      COALESCE(reciprocalChecked, 0) AS reciprocalChecked,
                      COALESCE(aiScore, 0) AS aiScore,
                      COALESCE(sortOrder, 0) AS sortOrder,
                      COALESCE(showInSidebar, 1) AS showInSidebar,
                      createdAt
               FROM FriendLink
               ORDER BY COALESCE(sortOrder, 0) DESC,
                        CASE
                          WHEN typeof(createdAt) = 'integer' THEN createdAt
                          ELSE CAST(strftime('%s', createdAt) AS INTEGER) * 1000
                        END DESC
               LIMIT ? OFFSET ?`,
              limit,
              offset
            ),
            prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS total FROM FriendLink`),
          ]
    )

    const links = (linksRaw || []).map((item: any) => ({
      ...item,
      hasReciprocal: Boolean(toSafeNumber(item.hasReciprocal, 0)),
      reciprocalChecked: Boolean(toSafeNumber(item.reciprocalChecked, 0)),
      aiScore: toSafeNumber(item.aiScore, 0),
      sortOrder: toSafeNumber(item.sortOrder, 0),
      showInSidebar: Boolean(toSafeNumber(item.showInSidebar, 1)),
    }))
    const total = toSafeNumber(totalRaw?.[0]?.total, 0)

    return NextResponse.json({
      links: links || [],
      total: total || 0,
      page,
      limit,
      totalPages: Math.ceil((total || 0) / limit),
    })
  } catch (error) {
    console.error('[Admin FriendLinks Error]', error)
    return NextResponse.json({ error: '获取失败', links: [], total: 0 }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const name = (body?.name || '').trim()
    const url = normalizeUrl(body?.url || '')
    const description = (body?.description || '').trim()
    const faviconInput = (body?.favicon || '').trim()
    const email = (body?.email || '').trim()
    const status = ['pending', 'approved', 'rejected'].includes(body?.status) ? body.status : 'approved'
    const showInSidebar = toSafeBoolean(body?.showInSidebar, true)
    const sortOrder = Math.trunc(toSafeNumber(body?.sortOrder, 0))

    if (!name) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
    if (!url) return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 })

    const existing = await prisma.friendLink.findFirst({ where: { url } })
    if (existing) return NextResponse.json({ error: '该链接已存在' }, { status: 400 })

    const favicon = faviconInput || (await getFavicon(url))

    const link = await prisma.friendLink.create({
      data: {
        name,
        url,
        description: description || null,
        favicon: favicon || null,
        email: email || null,
        status,
        showInSidebar,
        sortOrder,
        approvedAt: status === 'approved' ? new Date() : null,
      },
    })

    revalidateTag('approved-friend-links')
    return NextResponse.json(toJsonSafe(link))
  } catch (error) {
    console.error('[Admin FriendLinks Create Error]', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
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
    const payload = await req.json()
    const { action, rejectionReason, delta, sortOrder } = payload

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
      revalidateTag('approved-friend-links')
      syslog.info('friendlink', `友链已批准: ${link.name} (${link.url})`, { id }).catch(() => {})
      return NextResponse.json({
        message: '已批准',
        link,
      })
    } else if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json({ error: '请提供拒绝原因' }, { status: 400 })
      }

      const link = await prisma.friendLink.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason,
        },
      })
      revalidateTag('approved-friend-links')
      syslog.info('friendlink', `友链已拒绝: ${link.name} (${link.url}) — ${rejectionReason}`, { id }).catch(() => {})
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
    } else if (action === 'change-order') {
      const orderDelta = toSafeNumber(delta, 0)
      if (!orderDelta) {
        return NextResponse.json({ error: '无效的排序参数' }, { status: 400 })
      }

      await prisma.$executeRawUnsafe(
        `UPDATE FriendLink
         SET sortOrder = COALESCE(sortOrder, 0) + ?
         WHERE id = ?`,
        orderDelta,
        id
      )

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, COALESCE(sortOrder, 0) AS sortOrder FROM FriendLink WHERE id = ?`,
        id
      )

      revalidateTag('approved-friend-links')

      return NextResponse.json({
        message: orderDelta > 0 ? '已上移' : '已下移',
        sortOrder: toSafeNumber(rows?.[0]?.sortOrder, 0),
      })
    } else if (action === 'set-order') {
      const nextOrder = Math.trunc(toSafeNumber(sortOrder, Number.NaN))
      if (!Number.isFinite(nextOrder)) {
        return NextResponse.json({ error: '排序权重必须是数字' }, { status: 400 })
      }

      await prisma.$executeRawUnsafe(
        `UPDATE FriendLink
         SET sortOrder = ?
         WHERE id = ?`,
        nextOrder,
        id
      )

      revalidateTag('approved-friend-links')

      return NextResponse.json({
        message: '排序权重已更新',
        sortOrder: nextOrder,
      })
    } else if (action === 'toggle-sidebar') {
      const nextShowInSidebar = toSafeBoolean(payload?.showInSidebar, false)

      await prisma.$executeRawUnsafe(
        `UPDATE FriendLink
         SET showInSidebar = ?
         WHERE id = ?`,
        nextShowInSidebar ? 1 : 0,
        id
      )

      revalidateTag('approved-friend-links')

      return NextResponse.json({
        message: nextShowInSidebar ? '已显示在右侧栏' : '已从右侧栏隐藏',
        showInSidebar: nextShowInSidebar,
      })
    } else if (action === 'update-basic') {
      const nextName = String(payload?.name ?? '').trim()
      const nextUrl = normalizeUrl(String(payload?.url ?? ''))
      const nextDescription = String(payload?.description ?? '').trim()
      const nextFaviconInput = String(payload?.favicon ?? '').trim()
      const nextEmail = String(payload?.email ?? '').trim()
      const nextStatus = ['pending', 'approved', 'rejected'].includes(String(payload?.status))
        ? String(payload?.status)
        : null
      const nextShowInSidebar = toSafeBoolean(payload?.showInSidebar, true)
      const nextSortOrder = Math.trunc(toSafeNumber(payload?.sortOrder, 0))

      if (!nextName) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
      if (!nextUrl) return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 })

      const nextFavicon = nextFaviconInput || (await getFavicon(nextUrl))

      const updated = await prisma.friendLink.update({
        where: { id },
        data: {
          name: nextName,
          url: nextUrl,
          description: nextDescription || null,
          favicon: nextFavicon || null,
          email: nextEmail || null,
          showInSidebar: nextShowInSidebar,
          sortOrder: nextSortOrder,
          ...(nextStatus
            ? {
                status: nextStatus,
                approvedAt: nextStatus === 'approved' ? new Date() : null,
                rejectionReason: nextStatus === 'rejected' ? rejectionReason || payload?.rejectionReason || '' : null,
              }
            : {}),
        },
      })

      revalidateTag('approved-friend-links')
      return NextResponse.json(toJsonSafe(updated))
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
    revalidateTag('approved-friend-links')
    syslog.info('friendlink', `友链已删除: id=${id}`).catch(() => {})
    return NextResponse.json({ message: '已删除' })
  } catch (error) {
    console.error('[Admin FriendLinks Delete Error]', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
