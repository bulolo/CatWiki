import type { Metadata } from 'next'
import './globals.css'
import { AdminLayoutClient } from '@/components/layout/AdminLayoutClient'

// 使用系统字体栈，避免 Google Fonts 网络问题
const fontSans = 'font-sans'

// Metadata 配置（仅在服务端组件中可用）
export const metadata: Metadata = {
  title: {
    default: 'catWiki 管理后台',
    template: '%s | catWiki 管理后台',
  },
  description: 'catWiki 管理后台 - 企业级AI知识库平台',
  keywords: ['知识库', '文档管理', 'Wiki', 'catWiki'],
  authors: [{ name: 'catWiki Team' }],
  creator: 'catWiki',
  robots: {
    index: false, // 管理后台不需要被搜索引擎索引
    follow: false,
  },
}

/**
 * 根布局 - 服务端组件
 * 负责：
 * 1. HTML 结构和 metadata
 * 2. 全局样式导入
 * 3. 将客户端逻辑委托给 AdminLayoutClient
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={fontSans}>
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </body>
    </html>
  )
}

