import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'License Manager', description: 'project-x 授权管理' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#0a0a0a', color: '#e7e9ea' }}>
        {children}
      </body>
    </html>
  )
}
