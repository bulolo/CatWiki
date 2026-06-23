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

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  LogOut,
  ChevronDown,
  Lock
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@/components/ui"
import { logout } from "@/lib/auth"
import { useCurrentUser } from "@/lib/auth-store"
import { toast } from "sonner"
import { ChangePasswordModal } from "@/components/settings/users/ChangePasswordModal"

export function UserMenu() {
  const t = useTranslations("UserMenu")
  const [mounted, setMounted] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const user = useCurrentUser()
  const confirm = useConfirm()

  const handleLogout = async () => {
    if (!await confirm({ description: t("logoutConfirm") })) return
    toast.success(t("logoutSuccess"))
    logout()
  }

  // 获取显示的名称
  const displayName = user?.name || t("admin")
  const initials = displayName.substring(0, 2).toUpperCase()

  // 获取显示的职业/角色
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "admin" as const:
        return t("sysAdmin")
      case "tenant_admin" as const:
        return t("tenantAdmin")
      case "site_admin" as const:
        return t("siteAdmin")
      default:
        return t("regularUser")
    }
  }

  const roleLabel = getRoleLabel(user?.role)

  if (!mounted) {
    return (
      <div className="flex items-center gap-2.5 p-1 rounded-full border border-transparent">
        <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
        <ChevronDown className="h-3.5 w-3.5 text-slate-200" />
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-50 transition-all outline-none group border border-transparent hover:border-slate-100">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/30 group-hover:bg-white">
            <span className="text-xs font-bold text-slate-500 group-hover:text-primary">{initials}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl border-slate-200 shadow-lg mt-1 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="px-3 py-2.5 mb-1 pb-2 border-b border-slate-50">
            <p className="text-sm font-bold text-slate-800 tracking-tight">{displayName}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-widest mt-0.5">{roleLabel}</p>
          </div>

          <DropdownMenuItem
            className="rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer focus:bg-slate-50 transition-colors font-medium text-slate-600 focus:text-primary"
            onSelect={() => setShowPasswordModal(true)}
          >
            <Lock className="h-4 w-4 opacity-70" />
            <span className="text-sm">{t("changePassword")}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-slate-50" />

          <DropdownMenuItem
            className="rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer text-red-500 focus:bg-red-50 focus:text-red-600 transition-colors font-medium"
            onSelect={handleLogout}
          >
            <LogOut className="h-4 w-4 opacity-70" />
            <span className="text-sm">{t("logout")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordModal
        open={showPasswordModal}
        onOpenChange={setShowPasswordModal}
      />
    </>
  )
}
