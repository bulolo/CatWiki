/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // 开启 Strict Mode 以检测潜在问题
  output: 'standalone', // 支持 Docker 部署
  
  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/v1/files/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 编译优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
}

module.exports = nextConfig

