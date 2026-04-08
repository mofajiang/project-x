import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteConfig } from '@/lib/config'
import { buildSlugCandidates } from '@/lib/slug'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug
  const slugCandidates = buildSlugCandidates(slug)

  const [post, config] = await Promise.all([
    prisma.post.findFirst({
      where: { slug: { in: slugCandidates }, published: true },
      select: {
        title: true,
        excerpt: true,
        author: { select: { displayName: true, username: true } },
        publishedAt: true,
      },
    }),
    getSiteConfig(),
  ])

  if (!post) {
    return new Response('Not Found', { status: 404 })
  }

  const siteName = config.siteName || '我的博客'
  const author = post.author.displayName || post.author.username
  const desc = post.excerpt || ''
  const date = post.publishedAt
    ? post.publishedAt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.title}
          </div>
          {desc && (
            <div
              style={{
                fontSize: 24,
                color: '#a0aec0',
                lineHeight: 1.5,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {desc.slice(0, 120)}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#e53e3e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {author[0]?.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 20, color: '#e2e8f0', fontWeight: 600 }}>{author}</span>
              {date && <span style={{ fontSize: 16, color: '#718096' }}>{date}</span>}
            </div>
          </div>
          <div style={{ fontSize: 20, color: '#718096', fontWeight: 600 }}>
            {siteName}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
