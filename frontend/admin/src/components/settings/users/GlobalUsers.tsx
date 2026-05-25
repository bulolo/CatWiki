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

import {
  LoadingState,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useConfirm
} from "@/components/ui"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Shield,
  MoreHorizontal,
  Check,
  KeyRound,
  Trash2,
  Loader2,
  Plus,
  ChevronLeft,
  Slash
} from "lucide-react"
import { toast } from "sonner"
import { CreateUserForm } from "./CreateUserForm"
import { UserRole, UserStatus, type UserListItem, type Site } from "@/lib/sdk/sdk.schemas"
import { useTranslations } from "next-intl"


import {
  useUsers,
  useUpdateUserRole,
  useUpdateUserStatus,
  useResetUserPassword,
  useDeleteUser,
  useDebounce,
  useSitesList,
  useUpdateUserSites
} from "@/hooks"
import { getUserInfo } from "@/lib/auth"
import { useHealth } from "@/hooks/useHealth"

type PasswordResponse = {
  password: string
}

function parsePasswordResponse(data: unknown): PasswordResponse | null {
  if (!data || typeof data !== "object") {
    return null
  }
  const password = (data as { password?: unknown }).password
  return typeof password === "string" ? { password } : null
}

export function GlobalUsers() {
  const t = useTranslations("Users")
  const commonT = useTranslations("Common")
  const confirm = useConfirm()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: healthData } = useHealth()
  const isCommunity = healthData?.edition === "community"

  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const isCreating = searchParams.get("action") === "create"

  // 获取所有站点列表（用于显示站点名称）
  const { data: sitesList } = useSitesList({ page: 1, size: 100 })
  const sitesMap = new Map<number, Site>(sitesList?.map((site: Site) => [site.id, site] as [number, Site]) || [])

  // React Query hooks - 全局用户列表，不需要 siteId
  const { data: usersData, isLoading: loading, refetch: refetchUsers } = useUsers({
    page,
    size: 20, /* 每页多显示一些 */
    search: debouncedSearchTerm.trim() || undefined,
  })

  // hooks
  const updateUserRoleMutation = useUpdateUserRole()
  const updateUserStatusMutation = useUpdateUserStatus()
  const updateUserSitesMutation = useUpdateUserSites()
  const resetPasswordMutation = useResetUserPassword()
  const deleteUserMutation = useDeleteUser()

  const users = usersData?.users || []

  const currentUser = getUserInfo()
  const isSystemAdmin = currentUser?.role === "admin" as const

  const handleStartCreate = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("action", "create")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleCancelCreate = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleCreateSuccess = () => {
    refetchUsers()
    handleCancelCreate()
  }

  if (isCreating) {
    return (
      <div key="create" className="animate-in fade-in slide-in-from-right-4 duration-300">
        <CreateUserForm
          onCancel={handleCancelCreate}
          onSuccess={handleCreateSuccess}
        />
      </div>
    )
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!await confirm({ description: t("deleteConfirm", { name: userName }), variant: "destructive" })) return

    deleteUserMutation.mutate(userId, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"))
        refetchUsers()
      }
    })
  }

  const updateRole = async (userId: number, newRole: UserRole) => {
    updateUserRoleMutation.mutate({
      userId,
      role: newRole
    }, {
      onSuccess: () => {
        toast.success(t("actions.changeRole") + " " + commonT("saveSuccess"))
        refetchUsers()
      }
    })
  }

  const updateStatus = async (userId: number, status: UserStatus, userName: string) => {
    const action = status === "active" as const ? t("statusEnable") : t("statusDisable")
    if (!await confirm({ description: t("statusConfirm", { action }) })) return

    updateUserStatusMutation.mutate({
      userId,
      status
    }, {
      onSuccess: () => {
        toast.success(t("statusUpdated"))
        refetchUsers()
      }
    })
  }

  const handleResetPassword = async (userId: number, userName: string, userEmail: string) => {
    if (!await confirm({ description: t("resetPasswordDialog.confirm", { name: userName }) })) return

    resetPasswordMutation.mutate(userId, {
      onSuccess: (data) => {
        const parsed = parsePasswordResponse(data)
        if (parsed) {
          const { password } = parsed
          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">{t("resetPasswordDialog.success")}</div>
              <div className="text-sm">
                <div>{t("resetPasswordDialog.userLabel")}: {userName} ({userEmail})</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{t("resetPasswordDialog.newPassword")}: </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("resetPasswordDialog.tip")}
              </div>
            </div>,
            { duration: 15000 }
          )
        }
      }
    })
  }

  // 子组件：行内站点管理单元格
  const UserSitesCell = ({ user }: { user: UserListItem }) => {
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

  return (
    <div key="list" className="animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="space-y-6">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("title")}</h2>
              <p className="text-sm text-slate-500 font-medium">{t("description")}</p>
            </div>
          </div>

          <Button
            className="flex items-center gap-2"
            size="sm"
            onClick={handleStartCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("addUser")}
          </Button>

        </div>

        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
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
                    <TableHead className="pl-6">{t("table.info")}</TableHead>
                    <TableHead>{t("table.role")}</TableHead>
                    <TableHead>{t("table.sites")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.lastLogin")}</TableHead>
                    <TableHead className="text-right pr-6">{t("table.actions")}</TableHead>
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
                              user.role === "tenant_admin" as const ? "secondary" :
                                user.role === "site_admin" as const ? "outline" : "outline"
                          }
                          className={cn(
                            "font-bold text-[10px] tracking-tight px-2 border-none",
                            user.role === "admin" as const ? "bg-primary text-primary-foreground" :
                              user.role === "tenant_admin" as const ? "bg-violet-500/10 text-violet-600" :
                                user.role === "site_admin" as const ? "bg-amber-500/10 text-amber-600" :
                                  "bg-muted text-muted-foreground"
                          )}
                        >
                          {user.role === "admin" as const ? (isCommunity ? t("roles.superAdmin") : t("roles.sysAdmin")) :
                            user.role === "tenant_admin" as const ? (isCommunity ? t("roles.superAdmin") : t("roles.orgAdmin")) :
                              user.role === "site_admin" as const ? t("roles.siteAdmin") : t("roles.unknown")}
                        </Badge>
                      </TableCell>
                      <UserSitesCell user={user} />
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            user.status === "active" as const ? "bg-emerald-500" : "bg-slate-300"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            user.status === "active" as const ? "text-emerald-600" : "text-slate-400"
                          )}>
                             {user.status === "active" as const ? t("status.active") : t("status.inactive")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-medium tabular-nums group-hover:text-slate-900 transition-colors">
                          {user.last_login_at || t("lastLoginNever")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
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
                                    {(healthData?.edition !== "community") && (
                                       <DropdownMenuItem 
                                        className="flex items-center justify-between rounded-xl px-3 py-2"
                                        onClick={() => updateRole(user.id, "admin" as const)}
                                       >
                                         <span className="text-sm font-medium">{t("roles.sysAdmin")}</span>
                                         {user.role === "admin" as const && <Check className="h-4 w-4 text-primary" />}
                                       </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem 
                                      className="flex items-center justify-between rounded-xl px-3 py-2"
                                      onClick={() => updateRole(user.id, "tenant_admin" as const)}
                                    >
                                      <span className="text-sm font-medium">{t("roles.orgAdmin")}</span>
                                      {user.role === "tenant_admin" as const && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="flex items-center justify-between rounded-xl px-3 py-2"
                                      onClick={() => updateRole(user.id, "site_admin" as const)}
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
                              onClick={() => handleResetPassword(user.id, user.name, user.email)}
                            >
                              <KeyRound className="h-4 w-4 opacity-70 text-amber-500" />
                              <span className="text-sm font-medium">{t("actions.resetPassword")}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1.5 opacity-40" />

                            {user.status === "active" as const ? (
                              <DropdownMenuItem 
                                className="flex items-center gap-2 rounded-xl px-2 py-2 text-slate-500 hover:text-slate-700 cursor-pointer"
                                onClick={() => updateStatus(user.id, "inactive" as const, user.name)}
                              >
                                <Slash className="h-4 w-4 opacity-70" />
                                <span className="text-sm font-medium">{t("actions.disableAccount")}</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="flex items-center gap-2 rounded-xl px-2 py-2 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                onClick={() => updateStatus(user.id, "active" as const, user.name)}
                              >
                                <Check className="h-4 w-4 opacity-70" />
                                <span className="text-sm font-medium">{t("actions.enableAccount")}</span>
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator className="my-1.5 opacity-40" />
                            <DropdownMenuItem 
                              className="flex items-center gap-2 rounded-xl px-2 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                            >
                              <Trash2 className="h-4 w-4 opacity-70" />
                              <span className="text-sm font-medium">{t("actions.deleteUser")}</span>
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
        </Card>
      </div>
    </div>
  )
}
