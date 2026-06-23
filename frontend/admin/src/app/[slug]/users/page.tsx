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

import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Input, LoadingState, useConfirm } from "@/components/ui"

import { useTranslations, useLocale } from "next-intl"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Shield,
  MoreHorizontal,
  Check,
  Globe,
  PlusCircle,
  KeyRound
} from "lucide-react"
import { toast } from "sonner"
import { UserRole, UserStatus, type UserListItem, type Site } from "@/lib/sdk/sdk.schemas"


import {
  useUsers,
  useInviteUser,
  useUpdateUserRole,
  useUpdateUserSites,
  useUpdateUserStatus,
  useResetUserPassword,
  useDeleteUser,
  useDebounce
} from "@/hooks"
import { useSite } from "@/contexts/SiteContext"
import { useCurrentUser } from "@/lib/auth-store"
import { parseInviteResponse, parsePasswordResponse } from "@/lib/user-response-parsers"

export default function UsersPage() {
  const t = useTranslations("SiteUsers")
  const confirm = useConfirm()
  const locale = useLocale()
  const [page] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  // 从 SiteContext 获取站点列表，避免重复请求
  const { sites: allSites } = useSite()
  const siteList = allSites.map((site: Site) => ({
    id: site.id,
    name: site.name
  }))


  // 邀请表单状态
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("site_admin" as const)
  const [selectedSites, setSelectedSites] = useState<number[]>([])

  // React Query hooks
  const { data: usersData, isLoading: loading } = useUsers({
    page,
    size: 10,
    search: debouncedSearchTerm.trim() || undefined,
  })

  const inviteUserMutation = useInviteUser()
  const updateUserRoleMutation = useUpdateUserRole()
  const updateUserSitesMutation = useUpdateUserSites()
  const updateUserStatusMutation = useUpdateUserStatus()
  const resetPasswordMutation = useResetUserPassword()
  const deleteUserMutation = useDeleteUser()

  const users = usersData?.users || []

  const currentUser = useCurrentUser()
  const isSystemAdmin = currentUser?.role === "admin" as const
  const isSiteAdmin = currentUser?.role === "site_admin" as const

  // 过滤展示的用户列表
  // 1. 站点管理员不能看到系统管理员
  // 2. 站点管理员只能看到由他们管理的站点的用户 (此处为前端过滤，后端也应有相应逻辑)
  const filteredUsers = users.filter((user: UserListItem) => {
    // 如果是系统管理员，能看所有
    if (isSystemAdmin) return true

    // 如果是站点管理员
    if (isSiteAdmin) {
      // 不能看到系统管理员
      if (user.role === "admin" as const) return false

      // 只能看到自己管理的站点的用户
      const mySites = currentUser?.managed_site_ids || []
      const hasSharedSite = user.managed_site_ids.some((id: number) => mySites.includes(id))
      return hasSharedSite
    }

    return false
  })


  const toggleSite = async (userId: number, siteId: number) => {
    const user = users.find((u: UserListItem) => u.id === userId)
    if (!user) return

    const isManaged = user.managed_site_ids.includes(siteId)
    const newSites = isManaged
      ? user.managed_site_ids.filter((id: number) => id !== siteId)
      : [...user.managed_site_ids, siteId]


    updateUserSitesMutation.mutate({
      userId,
      managed_site_ids: newSites
    }, {
      onSuccess: () => {
        toast.success(isManaged ? t("sitePermissionRemoved") : t("sitePermissionAdded"))
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


  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!await confirm({ description: t("deleteConfirm", { name: userName }), variant: "destructive" })) return

    deleteUserMutation.mutate(userId, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"))
      }
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
                <div>{t("userColon")} {userName} ({userEmail})</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{t("newPassword")} </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("resetSuccessTip")}
              </div>
            </div>,
            { duration: 15000 }
          )
        }
      }
    })
  }

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error(t("errorEmail"))
      return
    }

    inviteUserMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      managed_site_ids: selectedSites,
    }, {
      onSuccess: (data) => {
        const parsed = parseInviteResponse(data)
        if (parsed) {
          const { user, password } = parsed

          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">{t("createSuccess")}</div>
              <div className="text-sm">
                <div>{t("emailColon")} {user.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{t("tempPassword")} </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("createSuccessTip")}
              </div>
            </div>,
            { duration: 10000 }
          )

          setIsInviteOpen(false)

          // 重置表单
          setInviteEmail("")
          setInviteRole("site_admin" as const)
          setSelectedSites([])
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("description")}</p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("createUser")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("createUser")}</DialogTitle>
              <DialogDescription>
                {t("createUserDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t("emailLabel")}</label>
                <Input
                  placeholder="user@catwiki.cn"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t("roleLabel")}</label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("rolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {isSystemAdmin && (
                      <>
                        <SelectItem value={"admin" as const}>{t("roleSysAdmin")}</SelectItem>
                        <SelectItem value={"site_admin" as const}>{t("roleSiteAdmin")}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {inviteRole === "admin" as const && t("roleSysAdminDesc")}
                  {inviteRole === "site_admin" as const && t("roleSiteAdminDesc")}
                </p>
              </div>

              {inviteRole !== "admin" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">{t("assignSites")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {siteList.map((site: { id: number; name: string }) => (

                      <div
                        key={site.id}
                        onClick={() => {
                          setSelectedSites(prev =>
                            prev.includes(site.id)
                              ? prev.filter(id => id !== site.id)
                              : [...prev, site.id]
                          )
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all",
                          selectedSites.includes(site.id)
                            ? "bg-primary/5 border-primary text-primary"
                            : "bg-white border-border text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center",
                          selectedSites.includes(site.id) ? "border-primary bg-primary" : "border-slate-300"
                        )}>
                          {selectedSites.includes(site.id) && <Check className="h-2 w-2 text-white" />}
                        </div>
                        {site.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleInvite} disabled={!inviteEmail}>{t("createUser")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("empty")}
              description={t("emptyDesc")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.info")}</TableHead>
                  <TableHead>{t("table.role")}</TableHead>
                  <TableHead>{t("table.sites")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.lastLogin")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: UserListItem) => (

                  <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm border border-primary/10 uppercase">
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
                          user.role === "admin" as const ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" :
                            user.role === "tenant_admin" as const ? "bg-violet-500/10 text-violet-600 shadow-sm shadow-violet-500/10" :
                              user.role === "site_admin" as const ? "bg-amber-500/10 text-amber-600 shadow-sm shadow-amber-500/10" :
                                "bg-muted text-muted-foreground"
                        )}
                      >
                        {user.role === "admin" as const ? t("roles.sysAdmin") :
                          user.role === "tenant_admin" as const ? t("roles.orgAdmin") :
                            user.role === "site_admin" as const ? t("roles.siteAdmin") : user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                        {user.managed_site_ids.length > 0 ? (
                          user.managed_site_ids.map((siteId: number) => {

                            const site = siteList.find(s => s.id === siteId)
                            return (
                              <div key={siteId} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-600">
                                <Globe className="h-3 w-3 opacity-70" />
                                <span className="text-[11px] font-semibold">{site?.name || t("siteIdFallback", { id: siteId })}</span>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic font-medium">{t("noSites")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "success" : "outline"}>
                        {user.status === "active" ? t("status.active") : user.status === "inactive" ? t("status.disabled") : t("status.pending")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString(locale)
                        : t("neverLoggedIn")
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t("managePermissions")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>{t("changeRole")}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="w-48">
                                {isSystemAdmin && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() => updateRole(user.id, "admin" as const)}
                                      className="flex items-center justify-between"
                                    >
                                      <span>{t("roleSysAdmin")}</span>
                                      {user.role === "admin" as const && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => updateRole(user.id, "site_admin" as const)}
                                      className="flex items-center justify-between"
                                    >
                                      <span>{t("roleSiteAdmin")}</span>
                                      {user.role === "site_admin" as const && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2">{t("assignSitesAction")}</p>
                            {siteList.map((site: { id: number; name: string }) => (

                              <DropdownMenuItem
                                key={site.id}
                                className="flex items-center justify-between cursor-pointer"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  toggleSite(user.id, site.id)
                                }}
                              >
                                <span className="text-sm">{site.name}</span>
                                {user.managed_site_ids.includes(site.id) ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : (
                                  <PlusCircle className="h-4 w-4 text-slate-300" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onSelect={() => handleResetPassword(user.id, user.name, user.email)}
                          >
                            <KeyRound className="h-4 w-4 text-blue-500" />
                            <span>{t("resetPassword")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-orange-600"
                            onSelect={async () => {
                              const newStatus = user.status === "active" as const ? "inactive" as const : "active" as const
                              const ok = await confirm({ description: newStatus === "inactive" as const ? t("disableConfirm") : t("enableConfirm") })
                              if (ok) updateStatus(user.id, newStatus)
                            }}
                          >
                            {user.status === "active" as const ? t("disableAccount") : t("enableAccount")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={() => handleDeleteUser(user.id, user.name)}
                          >
                            {t("deleteUser")}
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
