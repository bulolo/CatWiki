// Copyright 2024 CatWiki Authors
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
import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  Building2,
  LayoutGrid
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { getSelectedTenantId, setSelectedTenantId, getUserInfo } from "@/lib/auth"
import api, { UserRole, Models } from "@/lib/api-client"
import { toast } from "sonner"

export function TenantSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // 检查权限
  const currentUser = typeof window !== 'undefined' ? getUserInfo() : null
  const isPlatformAdmin = currentUser?.role === UserRole.ADMIN

  const selectedTenantId = getSelectedTenantId()

  // 加载租户列表
  const { data: tenants = [], isLoading } = useQuery<Models.TenantSchema[]>({
    queryKey: ['tenants', 'list'],
    queryFn: async () => {
      const res = await api.tenant.list({ size: 100 })
      return res.list
    },
    enabled: isPlatformAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const selectedTenant = useMemo(() => {
    if (!selectedTenantId) return null
    return tenants.find(t => t.id === selectedTenantId)
  }, [tenants, selectedTenantId])

  const handleTenantSelect = (tenantId: number | null) => {
    setSelectedTenantId(tenantId)
    setOpen(false)
    // 切换租户后刷新页面，使 Header 注入生效并重新加载数据
    // 使用 window.location.href = '/' 而不是 reload()，确保清理掉 URL 中的旧站点路径（如 /site-slug/dashboard）
    // 避免切换到新租户后试图加载不存在的站点导致 404
    window.location.href = '/'
  }

  if (!isPlatformAdmin) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label="选择租户"
          className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-slate-100 transition-colors rounded-xl border border-transparent hover:border-slate-200"
        >
          <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden text-amber-600",
            selectedTenant?.logo_url ? "bg-transparent" : "bg-amber-100"
          )}>
            {selectedTenant?.logo_url ? (
              <img
                src={selectedTenant.logo_url}
                alt={selectedTenant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">系统租户</span>
            <span className="text-sm font-bold text-slate-900 leading-none">
              {selectedTenant ? selectedTenant.name : "全平台视图"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>切换管理租户</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => handleTenantSelect(null)}
          className="flex items-center gap-3 py-2.5 cursor-pointer"
        >
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            !selectedTenantId ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}>
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold truncate">全平台视图</span>
            <span className="text-xs text-slate-500 truncate">管理所有租户数据</span>
          </div>
        </DropdownMenuItem>

        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onSelect={() => handleTenantSelect(tenant.id)}
            className="flex items-center gap-3 py-2.5 cursor-pointer"
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center overflow-hidden w-7 h-7",
              tenant.logo_url ? "bg-transparent p-0" : (selectedTenantId === tenant.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500")
            )}>
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{tenant.name}</span>
              <span className="text-xs text-slate-500 truncate">{tenant.slug}</span>
            </div>
          </DropdownMenuItem>
        ))}

        {isLoading && tenants.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">加载中...</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
