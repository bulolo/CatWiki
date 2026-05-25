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

import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import "./globals.css"
import { AdminLayoutClient } from "@/components/layout/AdminLayoutClient"

// 使用系统字体栈，避免 Google Fonts 网络问题
const fontSans = "font-sans"

export const metadata: Metadata = {
  title: {
    default: "CatWiki Admin",
    template: "%s | CatWiki Admin",
  },
  description: "CatWiki Admin - AI Knowledge Base Platform",
  keywords: ["knowledge base", "document management", "Wiki", "CatWiki"],
}

/**
 * 根布局 - 服务端组件
 * 负责：
 * 1. HTML 结构和 metadata
 * 2. 全局样式导入
 * 3. 将客户端逻辑委托给 AdminLayoutClient
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={fontSans}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AdminLayoutClient>{children}</AdminLayoutClient>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

