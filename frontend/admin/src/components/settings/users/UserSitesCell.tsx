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

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, TableCell } from "@/components/ui"
import { Check, ChevronLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { UserListItem, Site } from "@/lib/sdk/sdk.schemas"
import type { useUpdateUserSites } from "@/hooks"

interface UserSitesCellProps {
  user: UserListItem
  sitesMap: Map<number, Site>
  sitesList: Site[] | undefined
  isCommunity: boolean
  updateUserSitesMutation: ReturnType<typeof useUpdateUserSites>
  refetchUsers: () => void
}

/**
 * 用户「管理站点」单元格。
 *
 * 必须定义在模块作用域（而非 GlobalUsers 内部），否则每次父组件 render 都会产生新的
 * 组件标识，导致表格每一行 remount —— 输入时弹层被关闭、本地 selectedIds 被重置。
 */
export function UserSitesCell({
  user,
  sitesMap,
  sitesList,
  isCommunity,
  updateUserSitesMutation,
  refetchUsers,
}: UserSitesCellProps) {
  const commonT = useTranslations("Common")
  const scT = useTranslations("Users.sitesCell")
  const rolesT = useTranslations("Users.roles")

  const [selectedIds, setSelectedIds] = useState<number[]>(user.managed_site_ids || [])
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateUserSitesMutation.mutate({
      userId: user.id,
      managed_site_ids: selectedIds
    }, {
      onSuccess: () => {
        setIsOpen(false)
        toast.success(scT("sync"))
        refetchUsers()
      }
    })
  }

  const toggleId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <TableCell
      className={cn(
        "relative group/cell p-0",
        user.role !== "admin" as const && "cursor-pointer hover:bg-muted/50 transition-colors"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {user.role === "admin" as const || user.role === "tenant_admin" as const ? (
        <div className="w-full h-full px-4 py-3 min-h-[50px] flex flex-wrap gap-1 items-center relative pr-8">
          <span className="text-xs text-muted-foreground">
            {user.role === "admin" as const ? rolesT("allPlatform") : (isCommunity ? rolesT("allSites") : rolesT("allOrg"))}
          </span>
        </div>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="w-full h-full px-4 py-3 min-h-[50px] flex flex-wrap gap-1 items-center relative pr-8">
              {user.managed_site_ids && user.managed_site_ids.length > 0 ? (
                user.managed_site_ids.map((siteId: number) => {
                  const site = sitesMap.get(siteId)
                  if (!site) return null
                  return (
                    <Badge key={siteId} variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-background">
                      {site.name}
                    </Badge>
                  )
                })
              ) : (
                <span className="text-xs text-muted-foreground group-hover/cell:text-primary transition-colors">{scT("clickToAssign")}</span>
              )}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 overflow-hidden" align="start">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-semibold text-xs text-slate-900">{scT("assignSites")}</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">{scT("assignDesc")}</p>
            </div>
            <div className="max-h-[240px] overflow-y-auto p-1.5 custom-scrollbar">
              {sitesList?.length === 0 ? (
                <div className="text-center text-[11px] text-muted-foreground py-6">{scT("noSites")}</div>
              ) : (
                sitesList?.map((site: Site) => (
                  <div
                    key={site.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                      selectedIds.includes(site.id) ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                    )}
                    onClick={() => toggleId(site.id)}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      selectedIds.includes(site.id) ? "bg-primary border-primary text-primary-foreground" : "border-slate-300 bg-white"
                    )}>
                      {selectedIds.includes(site.id) && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate">{site.name}</div>
                      <div className="text-[9px] opacity-60 truncate">{site.slug || (isCommunity ? "" : scT("noSlug"))}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/30">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-slate-500 hover:text-slate-900"
                onClick={() => {
                  setSelectedIds(user.managed_site_ids || [])
                  setIsOpen(false)
                }}
              >
                {commonT("cancel")}
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-[10px]"
                onClick={handleSave}
                disabled={updateUserSitesMutation.isPending}
              >
                {updateUserSitesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : scT("sync")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </TableCell>
  )
}
