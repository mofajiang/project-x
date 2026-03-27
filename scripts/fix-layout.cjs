const fs = require('fs')
const content = `import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: { default: '\u6211\u7684\u535a\u5ba2', template: '%s | \u6211\u7684\u535a\u5ba2' },
  description: '\u4e2a\u4eba\u535a\u5ba2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#16181C',
              color: '#E7E9EA',
              border: '1px solid #2F3336',
            },
          }}
        />
      </body>
    </html>
  )
}
`
fs.writeFileSync('src/app/layout.tsx', content, 'utf8')
console.log('layout.tsx fixed!')
