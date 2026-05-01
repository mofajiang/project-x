import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkFriendLinkOnTargetSite, validateUrl, getFavicon } from '@/lib/friend-link-checker'
import { reviewFriendLinkById } from '@/lib/friend-link-review'

export async function POST(req: NextRequest) {
  try {
    const { name, url, description, email, favicon: userFavicon, rssUrl } = await req.json()

    // 基础验证
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '网站名称不能为空' }, { status: 400 })
    }
    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 })
    }

    // 验证 URL
    const urlValidation = await validateUrl(url)
    if (!urlValidation.valid) {
      return NextResponse.json({ error: `URL 无法访问: ${urlValidation.error}` }, { status: 400 })
    }

    // 规范化 URL
    let finalUrl = url.trim()
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }

    // 并行执行：检查重复、获取 Favicon、检查互链
    const myDomain = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname
    const [existing, favicon, reciprocalCheck] = await Promise.all([
      prisma.friendLink.findFirst({ where: { url: finalUrl } }),
      userFavicon?.trim() ? Promise.resolve(userFavicon.trim()) : getFavicon(finalUrl),
      checkFriendLinkOnTargetSite(finalUrl, myDomain),
    ])

    if (existing) {
      return NextResponse.json({ error: '此链接已存在' }, { status: 400 })
    }

    // 创建友链记录（状态待定，需要 AI 审核）
    const link = await prisma.friendLink.create({
      data: {
        name: name.trim(),
        url: finalUrl,
        description: description?.trim() || null,
        favicon,
        email: email?.trim() || null,
        status: 'pending',
        hasReciprocal: reciprocalCheck.found,
        reciprocalChecked: true,
        reciprocalCheckTime: new Date(),
      },
    })

    // 保存 rssUrl（raw SQL，因 rssUrl 列通过迁移添加，不在 Prisma schema）
    if (rssUrl?.trim()) {
      await prisma.$executeRawUnsafe(`UPDATE FriendLink SET rssUrl = ? WHERE id = ?`, rssUrl.trim(), link.id)
    }

    // 自动后台触发 AI 审核（不阻塞提交响应）
    ;(async () => {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT enableAiDetection FROM SiteConfig WHERE id = 'singleton'`
        )
        const enabled = Boolean(Number(rows[0]?.enableAiDetection))
        if (!enabled) return

        const result = await reviewFriendLinkById(link.id)
        if (process.env.NODE_ENV === 'development')
          console.log(
            `[friend-link] auto AI review completed: link=${link.id} recommendation=${result.recommendation} score=${result.score}`
          )
      } catch (e) {
        console.warn('[friend-link] auto AI review failed:', e)
      }
    })()

    return NextResponse.json({
      id: link.id,
      message: '感谢提交！我们会尽快审核。',
      hasReciprocal: reciprocalCheck.found,
      reciprocalMessage: reciprocalCheck.found
        ? '✅ 已检测到互链，审核优先级更高'
        : '⚠️ 未检测到互链，可选择先添加后再提交',
    })
  } catch (error) {
    console.error('[FriendLink Submit Error]', error)
    return NextResponse.json({ error: '提交失败，请稍后重试' }, { status: 500 })
  }
}

/**
 * 用户可查询自己提交的友链状态
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const linkId = searchParams.get('id')

    if (linkId) {
      const link = await prisma.friendLink.findUnique({
        where: { id: linkId },
        select: {
          id: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
          approvedAt: true,
        },
      })

      if (!link) {
        return NextResponse.json({ error: '链接不存在' }, { status: 404 })
      }

      return NextResponse.json(link, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
      })
    }

    // 返回已通过的公开友链（供展示使用）
    const approvedLinks = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, url, description, favicon
       FROM FriendLink
       WHERE status = 'approved'
       ORDER BY COALESCE(sortOrder, 0) DESC,
                CASE
                  WHEN approvedAt IS NULL THEN 0
                  WHEN typeof(approvedAt) = 'integer' THEN approvedAt
                  ELSE CAST(strftime('%s', approvedAt) AS INTEGER) * 1000
                END DESC`
    )

    return NextResponse.json(approvedLinks, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('[FriendLink Get Error]', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
