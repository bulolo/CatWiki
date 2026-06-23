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

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { TrendingUp, ChevronRight } from "lucide-react"
import type { Document } from "@/lib/sdk/sdk.schemas"

/**
 * 热门文档卡片组件
 */
export function DocCard({ doc, onClick }: { doc: Document; onClick: () => void }) {
  const t = useTranslations("HomePage")
  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-12 translate-x-12 group-hover:bg-purple-500/10 transition-colors" />

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
          {doc.site_name || t("trending.defaultSite")}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
          <TrendingUp className="h-3 w-3 text-purple-400" />
          {t("trending.views", { count: doc.views || 0 })}
        </div>
      </div>

      <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 mb-2 flex-grow text-lg tracking-tight">
        {doc.title}
      </h4>

      <p className="text-sm text-slate-500 line-clamp-2 mb-5 leading-relaxed">
        {doc.summary || t("hero.description")}
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">
            {doc.author?.charAt(0) || "C"}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {doc.author || t("trending.defaultAuthor")} · {new Date(doc.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center text-primary text-[10px] font-bold gap-1 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
          {t("trending.readMore")} <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </motion.div>
  )
}
