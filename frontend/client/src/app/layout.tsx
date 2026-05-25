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
// 使用系统字体栈替代 Google Fonts，避免国内网络问题
const inter = { className: "font-sans" }
import { Toaster } from "sonner"
import { ReactQueryProvider } from "@/providers/ReactQueryProvider"
import { StatePersistence } from "@/components/layout"
import "./globals.css"

import { NextIntlClientProvider } from "next-intl"
import { getMessages, getLocale } from "next-intl/server"

export const metadata: Metadata = {
  title: "CatWiki - AI Knowledge Base",
  description: "CatWiki - Enterprise AI Knowledge Base Platform",
  icons: {
    icon: "/favicon.ico",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ReactQueryProvider>
            {children}
            <Toaster position="top-center" />
            <footer id="cw-sys-mount" className="fixed bottom-0 left-0 right-0 py-2 text-center text-[9px] text-muted-foreground/30 font-medium tracking-widest uppercase pointer-events-none z-50">
              Powered by <a href="https://catwiki.ai" target="_blank" className="hover:text-primary transition-colors pointer-events-auto">CatWiki</a>
            </footer>
            <StatePersistence />
          </ReactQueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

