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

import { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { BookOpen, ExternalLink, MessageCircle, Star, Users } from "lucide-react"
import { ClientSite } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface SiteCardProps {
  site: ClientSite
  onSelect: (site: ClientSite) => void
  onVisit: (site: ClientSite) => void
}

export function SiteCard({ site, onSelect, onVisit }: SiteCardProps) {
  const [imgError, setImgError] = useState(false)
  const hasValidIcon = site.icon && site.icon.trim() !== "" && !imgError

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all relative overflow-hidden flex flex-col h-full"
    >
      {/* 装饰性背景 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] translate-x-10 -translate-y-10 group-hover:bg-primary/10 transition-colors" />

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform group-hover:bg-white group-hover:border-primary/20 overflow-hidden">
          {hasValidIcon ? (
            <Image
              src={site.icon!}
              alt={site.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-black text-xl">
              {site.name?.charAt(0).toUpperCase() || "C"}
            </div>
          )}
        </div>

        {site.tenant_slug && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/50 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
            {site.tenant_slug}
          </div>
        )}
      </div>

      <div className="flex-1 relative z-10">
        <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors flex items-center gap-2">
          {site.name}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2 md:line-clamp-3 leading-relaxed mb-6">
          {site.description || "一个充满智慧的知识库，等待您的探索。"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        <button
          onClick={() => onVisit(site)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs md:text-sm hover:bg-slate-50 active:scale-95 transition-all"
        >
          <ExternalLink className="h-4 w-4" />
          访问详情
        </button>
        <button
          onClick={() => onSelect(site)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs md:text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          <MessageCircle className="h-4 w-4 fill-white" />
          AI 对话
        </button>
      </div>

      {/* 底部统计 */}
      <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          <span>{site.article_count || 0} 篇文章</span>
        </div>
        <div className="flex items-center gap-1">
          浏览量 {site.view_count !== undefined ? (site.view_count >= 1000 ? `${(site.view_count / 1000).toFixed(1)}k` : site.view_count) : 0}
        </div>
      </div>
    </motion.div>
  )
}
