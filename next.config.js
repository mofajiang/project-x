/** @type {import('next').NextConfig} */
const nextConfig = {
  // 信任反向代理（Nginx）转发的协议头，使 secure cookie 在 HTTPS 下正常工作
  trustHost: true,
  transpilePackages: ['@uiw/react-md-editor', '@uiw/react-markdown-preview'],
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
}

module.exports = nextConfig
