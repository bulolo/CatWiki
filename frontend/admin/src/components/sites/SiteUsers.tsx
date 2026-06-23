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

import { useTranslations, useLocale } from "next-intl"
import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useConfirm } from "@/components/ui"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Shield,
  MoreHorizontal,
  Check,
  Loader2,
  KeyRound,
  Trash2,
  Plus
} from "lucide-react"
import { toast } from "sonner"
import { CreateUserForm } from "@/components/settings/users/CreateUserForm"
import { UserRole, UserStatus, type UserListItem } from "@/lib/sdk/sdk.schemas"


import {
  useUsers,
  useUpdateUserRole,
  useUpdateUserSites,
  useUpdateUserStatus,
  useResetUserPassword,
  useDebounce
} from "@/hooks"
import { useCurrentUser } from "@/lib/auth-store"
import { parsePasswordResponse } from "@/lib/user-response-parsers"

interface SiteUsersProps {
  siteId: number
  siteName: string
}

export function SiteUsers({ siteId, siteName }: SiteUsersProps) {
  const t = useTranslations("SiteUsersPanel")
  const confirm = useConfirm()
  const locale = useLocale()
  const [page] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [isCreating, setIsCreating] = useState(false)

  // React Query hooks - 注意这里传入了 siteId
  const { data: usersData, isLoading: loading, refetch: refetchUsers } = useUsers({
    page,
    size: 20,
    search: debouncedSearchTerm.trim() || undefined,
    siteId: siteId,
  })

  // 所有用户 hook
  const updateUserRoleMutation = useUpdateUserRole()
  const updateUserSitesMutation = useUpdateUserSites()
  const updateUserStatusMutation = useUpdateUserStatus()
  const resetPasswordMutation = useResetUserPassword()

  const users = usersData?.users || []

  const currentUser = useCurrentUser()
  const isSystemAdmin = currentUser?.role === "admin" as const

  // 处理移除站点权限（如果移除当前站点，用户就不再出现在这个列表里了，类似于删除）
  const handleRemoveFromSite = async (userId: number, currentSites: number[]) => {
    if (!await confirm({ description: t("removeConfirm"), variant: "destructive" })) return

    const newSites = currentSites.filter((id: number) => id !== siteId)


    updateUserSitesMutation.mutate({
      userId,
      managed_site_ids: newSites
    }, {
      onSuccess: () => {
        toast.success(t("removeSuccess"))
      }
    })
  }

  const updateRole = async (userId: number, newRole: UserRole) => {
    updateUserRoleMutation.mutate({
      userId,
      role: newRole
    }, {
      onSuccess: () => toast.success(t("roleUpdated"))
    })
  }

  const updateStatus = async (userId: number, status: UserStatus) => {
    updateUserStatusMutation.mutate({
      userId,
      status
    }, {
      onSuccess: () => toast.success(t("statusUpdated"))
    })
  }


  const handleResetPassword = async (userId: number, userName: string, userEmail: string) => {
    if (!await confirm({ description: t("resetConfirm", { name: userName }) })) return

    resetPasswordMutation.mutate(userId, {
      onSuccess: (data) => {
        const parsed = parsePasswordResponse(data)
        if (parsed) {
          const { password } = parsed
          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">{t("resetSuccess")}</div>
              <div className="text-sm">
                <div>{t("user")}: {userName} ({userEmail})</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{t("newPassword")}: </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("resetTip")}
              </div>
            </div>,
            { duration: 15000 }
          )
        }
      }
    })
  }

  if (isCreating) {
    return (
      <CreateUserForm
        fixedSiteId={siteId}
        fixedSiteName={siteName}
        onCancel={() => setIsCreating(false)}
        onSuccess={() => {
          setIsCreating(false)
          refetchUsers()
        }}
      />
    )
  }

  return (
    <div className="space-y-6 w-full">
      <Card className="border-slate-200/60 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t("title")}</CardTitle>
                <CardDescription>
                  {t("description")}
                </CardDescription>
              </div>
            </div>

            <Button
              className="flex items-center gap-2"
              size="sm"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addMember")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-50 bg-slate-50/30">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-9 h-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">{t("info")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("lastLogin")}</TableHead>
                  <TableHead className="text-right pr-6">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: UserListItem) => (

                  <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm border border-primary/10 uppercase">
                          {user.name.slice(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm tracking-tight">{user.name}</span>
                          <span className="text-[11px] text-muted-foreground/70 font-medium">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "admin" as const ? "default" :
                            user.role === "tenant_admin" as const ? "default" :
                              user.role === "site_admin" as const ? "secondary" : "outline"
                        }
                        className={cn(
                          "font-bold text-[10px] tracking-tight px-2 border-none",
                          user.role === "admin" as const ? "bg-primary text-primary-foreground" :
                            user.role === "tenant_admin" as const ? "bg-violet-500/10 text-violet-600" :
                              user.role === "site_admin" as const ? "bg-amber-500/10 text-amber-600" :
                                "bg-muted text-muted-foreground"
                        )}
                      >
                        {user.role === "admin" as const ? t("roleSysAdmin") :
                          user.role === "tenant_admin" as const ? t("roleTenantAdmin") :
                            user.role === "site_admin" as const ? t("roleSiteAdmin") : user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          user.status === "active" as const ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {user.status === "active" as const ? t("active") : t("disabled")}
                        </span>

                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString(locale, {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                        : t("neverLoggedIn")
                      }
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t("userActions")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>{t("changeRole")}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="w-48">
                                {isSystemAdmin && (
                                  <DropdownMenuItem
                                    onSelect={() => updateRole(user.id, "site_admin" as const)}
                                    className="flex items-center justify-between"
                                  >
                                    <span>{t("roleSiteAdmin")}</span>
                                    {user.role === "site_admin" as const && <Check className="h-4 w-4 text-primary" />}
                                  </DropdownMenuItem>
                                )}

                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onSelect={() => handleResetPassword(user.id, user.name, user.email)}
                          >
                            <KeyRound className="h-4 w-4 text-blue-500" />
                            <span>{t("resetPassword")}</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-orange-600 flex items-center gap-2"
                            onSelect={async () => {
                              const newStatus = user.status === "active" as const ? "inactive" as const : "active" as const
                              const ok = await confirm({ description: newStatus === "inactive" as const ? t("disableConfirm") : t("enableConfirm") })
                              if (ok) updateStatus(user.id, newStatus)
                            }}
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              <span className={cn("w-2 h-2 rounded-full", user.status === "active" as const ? "bg-orange-500" : "bg-emerald-500")} />
                            </div>
                            {user.status === "active" as const ? t("disableAccount") : t("enableAccount")}
                          </DropdownMenuItem>


                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 flex items-center gap-2"
                            onSelect={() => handleRemoveFromSite(user.id, user.managed_site_ids)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>{t("removeFromSite")}</span>
                          </DropdownMenuItem>

                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card >
    </div >
  )
}
