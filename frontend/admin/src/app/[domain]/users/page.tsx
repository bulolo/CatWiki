"use client"

import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"

import { useState } from "react"
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
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Shield,
  MoreHorizontal,
  Check,
  Globe,
  PlusCircle,
  Loader2,
  KeyRound
} from "lucide-react"
import { toast } from "sonner"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserRole, UserStatus, type UserListItem, type Site } from "@/lib/api-client"


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
import { getUserInfo } from "@/lib/auth"
import { useEffect } from "react"

export default function UsersPage() {
  const [page, setPage] = useState(1)
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
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.EDITOR)
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
  const total = usersData?.total || 0

  const currentUser = getUserInfo()
  const isSystemAdmin = currentUser?.role === UserRole.ADMIN
  const isSiteAdmin = currentUser?.role === UserRole.SITE_ADMIN

  // 过滤展示的用户列表
  // 1. 站点管理员不能看到系统管理员
  // 2. 站点管理员只能看到由他们管理的站点的用户 (此处为前端过滤，后端也应有相应逻辑)
  const filteredUsers = users.filter((user: UserListItem) => {
    // 如果是系统管理员，能看所有
    if (isSystemAdmin) return true

    // 如果是站点管理员
    if (isSiteAdmin) {
      // 不能看到系统管理员
      if (user.role === UserRole.ADMIN) return false

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
        toast.success(isManaged ? "已移除站点权限" : "已添加站点权限")
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


  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`确定要删除用户"${userName}"吗？此操作无法撤销！`)) {
      return
    }

    deleteUserMutation.mutate(userId)
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

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("请输入邮箱")
      return
    }

    inviteUserMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      managed_site_ids: selectedSites,
    } as any, {
      onSuccess: (data) => {
        if (data && 'user' in data && 'password' in data) {
          const { user, password } = data as any

          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">用户创建成功！</div>
              <div className="text-sm">
                <div>邮箱: {user.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>临时密码: </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                请将此密码告知用户，用户首次登录后应修改密码
              </div>
            </div>,
            { duration: 10000 }
          )

          setIsInviteOpen(false)

          // 重置表单
          setInviteEmail("")
          setInviteRole(UserRole.EDITOR)
          setSelectedSites([])
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">用户管理</h1>
          <p className="text-slate-500 mt-2">在这里管理系统用户及其管理的站点权限。</p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              创建用户
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>创建用户</DialogTitle>
              <DialogDescription>
                创建新用户并分配角色和权限，系统将自动生成临时密码。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">邮箱地址</label>
                <Input
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">初始角色</label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSystemAdmin && (
                      <>
                        <SelectItem value={UserRole.ADMIN}>系统管理员</SelectItem>
                        <SelectItem value={UserRole.SITE_ADMIN}>站点管理员</SelectItem>
                      </>
                    )}
                    <SelectItem value={UserRole.EDITOR}>站点编辑</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {inviteRole === UserRole.ADMIN && "拥有系统最高权限，可管理所有站点和全局设置。"}
                  {inviteRole === UserRole.SITE_ADMIN && "可管理分配站点的所有内容和配置。"}
                  {inviteRole === UserRole.EDITOR && "仅可编辑和发布分配站点的文档。"}
                </p>
              </div>

              {inviteRole !== 'admin' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">分配站点</label>
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
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>取消</Button>
              <Button onClick={handleInvite} disabled={!inviteEmail}>创建用户</Button>
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
                placeholder="搜索用户名或邮箱..."
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
              title="暂无用户"
              description="该站点暂无用户，请尝试调整搜索条件或邀请新用户。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户信息</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>管理的站点</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: UserListItem) => (

                  <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm border border-primary/10 group-hover:scale-110 transition-transform duration-300 uppercase">
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
                          user.role === UserRole.ADMIN ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" :
                            user.role === UserRole.SITE_ADMIN ? "bg-amber-500/10 text-amber-600 shadow-sm shadow-amber-500/10" :
                              "bg-muted text-muted-foreground"
                        )}
                      >
                        {user.role === UserRole.ADMIN ? "系统管理员" :
                          user.role === UserRole.SITE_ADMIN ? "站点管理员" : "站点编辑"}
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
                                <span className="text-[11px] font-semibold">{site?.name || `站点 ID: ${siteId}`}</span>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic font-medium">未分配站点</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "success" : "outline"}>
                        {user.status === "active" ? "正常" : user.status === "inactive" ? "禁用" : "待激活"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('zh-CN')
                        : "从未登录"
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
                          <DropdownMenuLabel>管理权限</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>修改角色</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="w-48">
                                {isSystemAdmin && (
                                  <>
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
                                  </>
                                )}
                                {(isSystemAdmin || isSiteAdmin) && (
                                  <DropdownMenuItem
                                    onSelect={() => updateRole(user.id, UserRole.EDITOR)}
                                    className="flex items-center justify-between"
                                  >
                                    <span>站点编辑</span>
                                    {user.role === UserRole.EDITOR && <Check className="h-4 w-4 text-primary" />}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2">分配站点</p>
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
                            <span>重置密码</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-orange-600"
                            onSelect={() => {
                              const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE
                              if (confirm(`确定要${newStatus === UserStatus.INACTIVE ? '禁用' : '启用'}该账户吗？`)) {
                                updateStatus(user.id, newStatus)
                              }
                            }}
                          >
                            {user.status === UserStatus.ACTIVE ? '禁用该账户' : '启用该账户'}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={() => handleDeleteUser(user.id, user.name)}
                          >
                            删除用户
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

