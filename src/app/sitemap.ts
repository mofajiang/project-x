import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { getPostUrl } from '@/lib/post-link'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/archive`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tags`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/links`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  try {
    await runMigrations()
    const [posts, tags] = await Promise.all([
      prisma.post.findMany({
        where: { published: true },
        select: { slug: true, publicId: true, updatedAt: true, author: { select: { username: true } } },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.tag.findMany({
        select: { slug: true },
      }),
    ])

    const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
      url: getPostUrl(post, baseUrl),
      lastModified: post.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.9,
    }))

    const tagRoutes: MetadataRoute.Sitemap = tags.map((tag) => ({
      url: `${baseUrl}/tag/${tag.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    return [...staticRoutes, ...postRoutes, ...tagRoutes]
  } catch {
    // 构建时数据库不可用，返回静态路由
    return staticRoutes
  }
}
