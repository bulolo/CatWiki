// Copyright 2026 CatWiki Authors
// 
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 支持 Docker 部署

  // 编译器优化
  compiler: {
    // 生产环境自动移除 console.log, console.info, console.debug
    // 保留 console.error 和 console.warn（重要的错误信息）
    // removeConsole 使用 Turbopack 时暂不支持，需禁用或使用 swcMinify
    // removeConsole: process.env.NODE_ENV === 'production' ? {
    //   exclude: ['error', 'warn']
    // } : false
  },

  // 实验性优化配置
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'lodash',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
    ],
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

