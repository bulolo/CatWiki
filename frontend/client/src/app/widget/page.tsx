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

"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { ChatWidget } from "@/components/ChatWidget"

import { api } from "@/lib/api-client"
import type { Site } from "@/lib/api-client"

interface WebWidgetConfig {
  title?: string
  position?: "left" | "right"
  primaryColor?: string
  welcomeMessage?: string
}

interface BotConfig {
  webWidget?: WebWidgetConfig
}

function WidgetContent() {
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [siteConfig, setSiteConfig] = useState<BotConfig | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [site, setSite] = useState<Site | null>(null)

  const siteId = searchParams.get("siteId")
  const queryTitle = searchParams.get("title")
  const queryPosition = searchParams.get("position")
  const queryColor = searchParams.get("color")
  const queryWelcomeMessage = searchParams.get("welcomeMessage")

  useEffect(() => {
    if (siteId) {
      const sid = parseInt(siteId);
      if (!isNaN(sid)) {
        api.site.get(sid).then((res) => {
          setSite(res)
          if (res.bot_config) {
            setSiteConfig(res.bot_config as BotConfig)
          }
        }).catch(err => {
          console.error("Failed to fetch site config:", err);
        }).finally(() => {
          setIsReady(true)
        })
      } else {
        setIsReady(true)
      }
    } else {
      setIsReady(true)
    }
  }, [siteId])

  // 合并配置：Query 参数优先级高于数据库配置
  // 注意：如果 query 参数存在但为空字符串，应该被视为没有提供，从而使用数据库配置
  const title = queryTitle || siteConfig?.webWidget?.title || "AI 客服助手"
  const position = ((queryPosition || siteConfig?.webWidget?.position) as "left" | "right") || "right"
  const color = queryColor || siteConfig?.webWidget?.primaryColor || "#3b82f6"
  const welcomeMessage = queryWelcomeMessage || siteConfig?.webWidget?.welcomeMessage || ""

  useEffect(() => {
    if (isReady) {
      window.parent.postMessage({
        type: "chat-widget:ready"
      }, "*")
    }
  }, [isReady])

  const handleToggle = (open: boolean) => {
    setIsOpen(open)
    // Notify parent window to resize iframe
    window.parent.postMessage({ type: "chat-widget:toggle", isOpen: open }, "*")
  }

  useEffect(() => {
    // Force transparent background for the widget iframe
    const originalBodyBg = document.body.style.background
    const originalHtmlBg = document.documentElement.style.background

    document.body.style.setProperty('background', 'transparent', 'important')
    document.documentElement.style.setProperty('background', 'transparent', 'important')

    return () => {
      document.body.style.background = originalBodyBg
      document.documentElement.style.background = originalHtmlBg
    }
  }, [])

  return (
    <div className={`transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
      <style jsx global>{`
        html, body {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important; /* Prevent scrollbars in the iframe */
          box-shadow: none !important;
        }
        /* Ensure Next.js root div is also transparent */
        #__next, [data-reactroot] {
           background: transparent !important;
        }
      `}</style>
      <ChatWidget
        title={title}
        position={position}
        primaryColor={color}
        welcomeMessage={welcomeMessage}
        isOpen={isOpen}
        onToggle={handleToggle}
        siteId={siteId ? parseInt(siteId) : null}
        allSites={site ? [site] : undefined}
      />
    </div>
  )
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="bg-transparent" />}>
      <WidgetContent />
    </Suspense>
  )
}
