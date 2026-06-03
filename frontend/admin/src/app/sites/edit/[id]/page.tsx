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

import { useRouter, useParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui"
import { SiteSettings } from "@/components/settings/sites"

/**
 * 站点编辑页 —— 历史遗留整页路由 (/sites/edit/[id])。
 *
 * 早期实现独立维护一份与 SettingsModal 中 `<SiteSettings />` 几乎重复的
 * 表单/保存/状态机，每次新增字段都要双写。已统一收敛到组件层，本页只保留：
 *   1. URL 兼容（书签、外部链接仍然可用）
 *   2. 顶部返回按钮 + 整页 padding
 * 真正的设置 UI 由 <SiteSettings> 提供。
 */
export default function EditSitePage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params.id as string
  const siteId = Number.parseInt(rawId, 10)

  if (!Number.isFinite(siteId) || siteId <= 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500">
        Invalid site id: {rawId}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 h-full flex flex-col">
      <div className="mb-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-xl hover:bg-slate-100 transition-colors h-10 w-10 border border-slate-200 bg-white"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <SiteSettings siteId={siteId} onBack={() => router.back()} />
      </div>
    </div>
  )
}
