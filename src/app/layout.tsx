import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToasterProvider } from '@/components/ToasterProvider'
import { getSiteConfig } from '@/lib/config'
import { VisitorTracker } from '@/components/VisitorTracker'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig()
  const icon = '/favicon.ico'
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    metadataBase: new URL(baseUrl),
    title: { default: config.siteName || '我的博客', template: `%s | ${config.siteName || '我的博客'}` },
    description: config.siteDesc || '个人博客',
    icons: { icon, shortcut: icon, apple: icon },
    openGraph: {
      type: 'website',
      siteName: config.siteName || '我的博客',
      description: config.siteDesc || '个人博客',
    },
    twitter: {
      card: 'summary_large_image',
      site: config.socialX ? `@${config.socialX}` : undefined,
    },
    robots: { index: true, follow: true },
    alternates: {
      types: {
        'application/rss+xml': `${baseUrl}/feed.xml`,
      },
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig()
  const defaultTheme = config.defaultTheme || 'dark'
  const antiFlash = `(function(){var t=localStorage.getItem('theme');var d=${JSON.stringify(defaultTheme)};var theme=t||d;if(theme==='light')document.documentElement.classList.add('light');})()`
  const visitorGeoMode = config.visitorGeoMode || 'offline'
  const visitorGeoEndpoint = config.visitorGeoEndpoint || ''
  const visitorGeoKey = config.visitorGeoKey || ''
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName || '我的博客',
    url: baseUrl,
    description: config.siteDesc || '个人博客',
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  }
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlash }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <link rel="alternate" type="application/rss+xml" title={config.siteName || '我的博客'} href="/feed.xml" />
      </head>
      <body>
        {children}
        <VisitorTracker visitorGeoMode={visitorGeoMode} visitorGeoEndpoint={visitorGeoEndpoint} visitorGeoKey={visitorGeoKey} />
        <ToasterProvider />
      </body>
    </html>
  )
}
