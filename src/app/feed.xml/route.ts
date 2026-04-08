import { prisma } from '@/lib/prisma'
import { getSiteConfig } from '@/lib/config'
import { NextResponse } from 'next/server'

export const revalidate = 3600

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(req: Request) {
  const config = await getSiteConfig()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || `https://${req.headers.get('host') || 'localhost'}`
  const siteName = config.siteName || '我的博客'
  const siteDesc = config.siteDesc || ''

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { displayName: true, username: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  })

  const items = posts
    .map((post) => {
      const url = `${siteUrl}/post/${post.slug}`
      const date = (post.publishedAt || post.createdAt).toUTCString()
      const desc = post.excerpt || post.content.slice(0, 200).replace(/[#*`>\[\]]/g, '')
      const author = post.author.displayName || post.author.username
      const categories = post.tags?.map((t) => `\n      <category>${escapeXml(t.tag.name)}</category>`).join('') || ''
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(desc)}</description>
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
      <author>${escapeXml(author)}</author>
      <pubDate>${date}</pubDate>${categories}
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <ttl>60</ttl>${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
