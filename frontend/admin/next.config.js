/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 支持 Docker 部署
  
  // 编译器优化
  compiler: {
    // 生产环境自动移除 console.log, console.info, console.debug
    // 保留 console.error 和 console.warn（重要的错误信息）
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false
  },
  
  // 图片优化配置
  images: {
    // 允许的外部图片域名
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/catwiki/**',
      },
      {
        protocol: 'https',
        hostname: '*.your-domain.com', // 生产环境域名
        pathname: '/**',
      }
    ],
    // 图片格式优化
    formats: ['image/webp', 'image/avif'],
    // 图片尺寸配置
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  }
}

module.exports = nextConfig

