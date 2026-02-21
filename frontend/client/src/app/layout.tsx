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

import type { Metadata } from 'next'
// 使用系统字体替代 Google Fonts，避免国内网络问题
// import { Inter } from 'next/font/google'
// const inter = Inter({ subsets: ['latin'] })
// 使用系统字体栈
const inter = { className: 'font-sans' }
import { Toaster } from 'sonner'
import { ReactQueryProvider } from '@/providers/ReactQueryProvider'
import { StatePersistence } from '@/components/layout/StatePersistence'
import './globals.css'

export const metadata: Metadata = {
  title: 'CatWiki - 企业级AI知识库平台',
  description: 'CatWiki - 企业级全栈 AI 知识库平台，集成了现代化的内容管理、深度 AI 智能问答与极致的用户交互体验。',
  icons: {
    icon: '/favicon.ico',
  },
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
          <footer id="cw-sys-mount" className="fixed bottom-0 left-0 right-0 py-2 text-center text-[9px] text-muted-foreground/30 font-medium tracking-widest uppercase pointer-events-none z-50">
            Powered by <a href="https://catwiki.ai" target="_blank" className="hover:text-primary transition-colors pointer-events-auto">CatWiki</a>
          </footer>
          <StatePersistence />
        </ReactQueryProvider>
      </body>
    </html>
  )
}

