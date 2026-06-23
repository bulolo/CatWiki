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
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui"
import { Shield, MoreHorizontal, Check, KeyRound, Trash2, Slash } from "lucide-react"
import { UserRole, UserStatus, type UserListItem } from "@/lib/sdk/sdk.schemas"

interface UserRowActionsProps {
  user: UserListItem
  isSystemAdmin: boolean
  canAssignSysAdmin: boolean
  onUpdateRole: (userId: number, role: UserRole) => void
  onResetPassword: (userId: number, userName: string, userEmail: string) => void
  onUpdateStatus: (userId: number, status: UserStatus, userName: string) => void
  onDeleteUser: (userId: number, userName: string) => void
}

export function UserRowActions({
  user, isSystemAdmin, canAssignSysAdmin,
  onUpdateRole, onResetPassword, onUpdateStatus, onDeleteUser,
}: UserRowActionsProps) {
  const t = useTranslations("Users")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="hover:bg-slate-100">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t("actions.label")}</DropdownMenuLabel>

        {isSystemAdmin && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 rounded-xl px-2 py-2">
              <Shield className="h-4 w-4 opacity-70" />
              <span className="text-sm font-medium">{t("actions.changeRole")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48 p-1">
                {canAssignSysAdmin && (
                   <DropdownMenuItem
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    onClick={() => onUpdateRole(user.id, "admin" as const)}
                   >
                     <span className="text-sm font-medium">{t("roles.sysAdmin")}</span>
                     {user.role === "admin" as const && <Check className="h-4 w-4 text-primary" />}
                   </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                  onClick={() => onUpdateRole(user.id, "tenant_admin" as const)}
                >
                  <span className="text-sm font-medium">{t("roles.orgAdmin")}</span>
                  {user.role === "tenant_admin" as const && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                  onClick={() => onUpdateRole(user.id, "site_admin" as const)}
                >
                  <span className="text-sm font-medium">{t("roles.siteAdmin")}</span>
                  {user.role === "site_admin" as const && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        )}

        <DropdownMenuItem
          className="flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer"
          onClick={() => onResetPassword(user.id, user.name, user.email)}
        >
          <KeyRound className="h-4 w-4 opacity-70 text-amber-500" />
          <span className="text-sm font-medium">{t("actions.resetPassword")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 opacity-40" />

        {user.status === "active" as const ? (
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-slate-500 hover:text-slate-700 cursor-pointer"
            onClick={() => onUpdateStatus(user.id, "inactive" as const, user.name)}
          >
            <Slash className="h-4 w-4 opacity-70" />
            <span className="text-sm font-medium">{t("actions.disableAccount")}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-emerald-600 hover:text-emerald-700 cursor-pointer"
            onClick={() => onUpdateStatus(user.id, "active" as const, user.name)}
          >
            <Check className="h-4 w-4 opacity-70" />
            <span className="text-sm font-medium">{t("actions.enableAccount")}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1.5 opacity-40" />
        <DropdownMenuItem
          className="flex items-center gap-2 rounded-xl px-2 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
          onClick={() => onDeleteUser(user.id, user.name)}
        >
          <Trash2 className="h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">{t("actions.deleteUser")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
