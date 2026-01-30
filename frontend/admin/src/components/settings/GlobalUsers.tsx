"use client"

import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { CreateUserForm } from "./CreateUserForm"
import {
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
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { UserRole, UserStatus, type UserListItem, type Site } from "@/lib/api-client"


import {
  useUsers,
  useInviteUser,
  useUpdateUserRole,
  useUpdateUserStatus,
  useResetUserPassword,
  useDeleteUser,
  useDebounce,
  useSitesList,
  useUpdateUserSites
} from "@/hooks"
import { getUserInfo } from "@/lib/auth"

export function GlobalUsers() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const isCreating = searchParams.get('action') === 'create'

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
  const inviteUserMutation = useInviteUser()
  const updateUserRoleMutation = useUpdateUserRole()
  const updateUserStatusMutation = useUpdateUserStatus()
  const updateUserSitesMutation = useUpdateUserSites() // Add this hook
  const resetPasswordMutation = useResetUserPassword()
  const deleteUserMutation = useDeleteUser()

  const users = usersData?.users || []
  const total = usersData?.total || 0

  const currentUser = getUserInfo()
  const isSystemAdmin = currentUser?.role === UserRole.ADMIN

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
      <CreateUserForm
        onCancel={handleCancelCreate}
        onSuccess={handleCreateSuccess}
      />
    )
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`确定要永久删除用户 "${userName}" 吗？此操作不可恢复！`)) {
      return
    }

    deleteUserMutation.mutate(userId, {
      onSuccess: () => {
        toast.success("用户已删除")
      }
    })
  }

  const updateRole = async (userId: number, newRole: UserRole) => {
    updateUserRoleMutation.mutate({
      userId,
      role: newRole
    })
  }

  const updateStatus = async (userId: number, status: UserStatus) => {

    updateUserStatusMutation.mutate({
      userId,
      status
    })
  }

  const handleResetPassword = async (userId: number, userName: string, userEmail: string) => {
    if (!confirm(`确定要重置用户"${userName}"的密码吗？`)) {
      return
    }

    resetPasswordMutation.mutate(userId, {
      onSuccess: (data) => {
        if (data && 'password' in data) {
          const password = (data as any).password
          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">密码重置成功！</div>
              <div className="text-sm">
                <div>用户: {userName} ({userEmail})</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>新密码: </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                请将此密码告知用户，建议用户尽快修改密码
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
        className="cursor-pointer hover:bg-muted/50 transition-colors relative group/cell p-0"
        onClick={(e) => e.stopPropagation()}
      >
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
                <span className="text-xs text-muted-foreground group-hover/cell:text-primary transition-colors">点击分配站点</span>
              )}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 overflow-hidden shadow-2xl" align="start">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-semibold text-xs text-slate-900">分配站点</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">选择该用户可管理的站点</p>
            </div>
            <div className="max-h-[240px] overflow-y-auto p-1.5 custom-scrollbar">
              {sitesList?.length === 0 ? (
                <div className="text-center text-[11px] text-muted-foreground py-6">暂无站点</div>
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
                      <div className="text-[9px] opacity-60 truncate">{site.domain || "无域名"}</div>
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
                取消
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-[10px]"
                onClick={handleSave}
                disabled={updateUserSitesMutation.isPending}
              >
                {updateUserSitesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "同步"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
    )
  }

  return (
    <div className="space-y-6">
      {/* ... (existing header and dialogs) */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">平台用户管理</h2>
            <p className="text-sm text-slate-500 font-medium">管理全平台的所有用户账户及权限。</p>
          </div>
        </div>

        <Button
          className="flex items-center gap-2 rounded-xl shadow-lg shadow-primary/20"
          size="default"
          onClick={handleStartCreate}
        >
          <Plus className="h-4 w-4" />
          添加成员
        </Button>

      </div>

      <Card className="border-border/60 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名或邮箱..."
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
              title="暂无用户"
              description="平台暂无用户数据。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">用户信息</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>所属站点</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right pr-6">操作</TableHead>
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
                          user.role === UserRole.ADMIN ? "default" :
                            user.role === UserRole.SITE_ADMIN ? "secondary" : "outline"
                        }
                        className={cn(
                          "font-bold text-[10px] tracking-tight px-2 border-none",
                          user.role === UserRole.ADMIN ? "bg-primary text-primary-foreground" :
                            user.role === UserRole.SITE_ADMIN ? "bg-amber-500/10 text-amber-600" :
                              "bg-muted text-muted-foreground"
                        )}
                      >
                        {user.role === UserRole.ADMIN ? "系统管理员" :
                          user.role === UserRole.SITE_ADMIN ? "站点管理员" : "站点编辑"}
                      </Badge>
                    </TableCell>
                    <UserSitesCell user={user} />
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          user.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {user.status === "active" ? "正常" : "禁用"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                        : "从未登录"
                      }
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[200]">
                          <DropdownMenuLabel>用户操作</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>修改角色</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="w-48 z-[200]">
                                <DropdownMenuItem
                                  onSelect={() => updateRole(user.id, UserRole.ADMIN)}
                                  className="flex items-center justify-between"
                                >
                                  <span>系统管理员</span>
                                  {user.role === UserRole.ADMIN && <Check className="h-4 w-4 text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => updateRole(user.id, UserRole.SITE_ADMIN)}
                                  className="flex items-center justify-between"
                                >
                                  <span>站点管理员</span>
                                  {user.role === UserRole.SITE_ADMIN && <Check className="h-4 w-4 text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => updateRole(user.id, UserRole.EDITOR)}
                                  className="flex items-center justify-between"
                                >
                                  <span>站点编辑</span>
                                  {user.role === UserRole.EDITOR && <Check className="h-4 w-4 text-primary" />}
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>


                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onSelect={() => handleResetPassword(user.id, user.name, user.email)}
                          >
                            <KeyRound className="h-4 w-4 text-blue-500" />
                            <span>重置密码</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-orange-600 flex items-center gap-2"
                            onSelect={() => {
                              const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE
                              if (confirm(`确定要${newStatus === UserStatus.INACTIVE ? '禁用' : '启用'}该账户吗？`)) {
                                updateStatus(user.id, newStatus)
                              }

                            }}
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              <span className={cn("w-2 h-2 rounded-full", user.status === 'active' ? "bg-orange-500" : "bg-emerald-500")} />
                            </div>
                            {user.status === 'active' ? '禁用该账户' : '启用该账户'}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 flex items-center gap-2"
                            onSelect={() => handleDeleteUser(user.id, user.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>永久删除用户</span>
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
