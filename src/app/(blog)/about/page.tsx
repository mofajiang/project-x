import { getSiteConfig } from '@/lib/config'
import { prisma } from '@/lib/prisma'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import Image from 'next/image'
import { isImageSource } from '@/lib/config'

export const revalidate = 300

export default async function AboutPage() {
  const config = await getSiteConfig()
  const author = await prisma.user.findFirst({
    select: { username: true, displayName: true, avatar: true, bio: true },
  })

  const displayName = author?.displayName || author?.username || config.siteName
  const bio = author?.bio || config.siteDesc
  const avatarUrl = author?.avatar || ''
  const isAvatarImage = avatarUrl && isImageSource(avatarUrl)
  const avatarFallback = (displayName || config.siteName).charAt(0).toUpperCase()

  return (
    <div>
      <div
        className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          关于
        </h1>
      </div>
      <div className="px-4 py-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-24 w-24 select-none items-center justify-center overflow-hidden rounded-full"
            style={{ background: isAvatarImage ? 'transparent' : 'var(--accent)', color: '#fff' }}
          >
            {isAvatarImage ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={96}
                height={96}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-3xl font-bold">{avatarFallback}</span>
            )}
          </div>
          <h2 className="mb-3 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {displayName}
          </h2>
          {bio && (
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <MarkdownRenderer content={bio} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {config.socialX && (
            <a
              href={`https://x.com/${config.socialX}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-5 py-2 text-sm font-bold transition-colors hover:opacity-80"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              𝕏 @{config.socialX}
            </a>
          )}
          {config.socialGithub && (
            <a
              href={`https://github.com/${config.socialGithub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-5 py-2 text-sm font-bold transition-colors hover:opacity-80"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              GitHub
            </a>
          )}
          {config.socialEmail && (
            <a
              href={`mailto:${config.socialEmail}`}
              className="rounded-full px-5 py-2 text-sm font-bold transition-colors hover:opacity-80"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              邮件联系
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
