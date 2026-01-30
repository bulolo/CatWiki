import type { Metadata } from 'next'
// 使用系统字体替代 Google Fonts，避免国内网络问题
// import { Inter } from 'next/font/google'
// const inter = Inter({ subsets: ['latin'] })
// 使用系统字体栈
const inter = { className: 'font-sans' }
import { Toaster } from 'sonner'
import { ReactQueryProvider } from '@/providers/ReactQueryProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'CatWiki - 企业级AI知识库平台',
  description: 'CatWiki - 企业级全栈 AI 知识库平台，集成了现代化的内容管理、深度 AI 智能问答与极致的用户交互体验。',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <ReactQueryProvider>
          {children}
          <Toaster position="top-center" />
        </ReactQueryProvider>
      </body>
    </html>
  )
}

