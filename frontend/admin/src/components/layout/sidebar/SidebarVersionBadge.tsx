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

import { cn } from "@/lib/utils"

interface SidebarVersionBadgeProps {
  edition?: string
  version: string
}

/** 侧边栏页脚的 EE/CE + 版本号徽标（三种侧边栏布局共用）。 */
export function SidebarVersionBadge({ edition, version }: SidebarVersionBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm",
        edition === "enterprise"
          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
          : "bg-muted text-muted-foreground border-border"
      )}>
        {edition === "enterprise" ? "EE" : "CE"}
      </span>
      <span className="px-2 py-0.5 bg-primary/5 text-primary/80 rounded-full text-[10px] font-bold border border-primary/10 shadow-sm">
        v{version}
      </span>
    </div>
  )
}
