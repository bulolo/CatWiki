"use client"

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Shield,
  MoreHorizontal,
  Check,
  PlusCircle,
  Loader2,
  KeyRound,
  Trash2,
  Plus
} from "lucide-react"
import { toast } from "sonner"
import { CreateUserForm } from "../settings/CreateUserForm"
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
import { UserRole, UserStatus, type UserListItem } from "@/lib/api-client"


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

interface SiteUsersProps {
  siteId: number
  siteName: string
}

export function SiteUsers({ siteId, siteName }: SiteUsersProps) {
  const [page, setPage] = useState(1)
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

  // 处理移除站点权限（如果移除当前站点，用户就不再出现在这个列表里了，类似于删除）
  const handleRemoveFromSite = async (userId: number, currentSites: number[]) => {
    if (!confirm("确定要将该用户从本站点移除吗？")) {
      return
    }

    const newSites = currentSites.filter((id: number) => id !== siteId)


    updateUserSitesMutation.mutate({
      userId,
      managed_site_ids: newSites
    }, {
      onSuccess: () => {
        toast.success("已移除用户站点权限")
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
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">站点用户管理</CardTitle>
                <CardDescription>
                  管理当前站点的成员及其权限级别。
                </CardDescription>
              </div>
            </div>

            <Button
              className="flex items-center gap-2 rounded-xl shadow-lg shadow-primary/20"
              size="sm"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4" />
              添加成员
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-50 bg-slate-50/30">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名或邮箱..."
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
              暂无用户数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">用户信息</TableHead>
                  <TableHead>角色</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          user.status === UserStatus.ACTIVE ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {user.status === UserStatus.ACTIVE ? "正常" : "禁用"}
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
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>用户操作</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>修改角色</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="w-48">
                                {isSystemAdmin && (
                                  <DropdownMenuItem
                                    onSelect={() => updateRole(user.id, UserRole.SITE_ADMIN)}
                                    className="flex items-center justify-between"
                                  >
                                    <span>站点管理员</span>
                                    {user.role === UserRole.SITE_ADMIN && <Check className="h-4 w-4 text-primary" />}
                                  </DropdownMenuItem>
                                )}
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
                              <span className={cn("w-2 h-2 rounded-full", user.status === UserStatus.ACTIVE ? "bg-orange-500" : "bg-emerald-500")} />
                            </div>
                            {user.status === UserStatus.ACTIVE ? '禁用该账户' : '启用该账户'}
                          </DropdownMenuItem>


                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 flex items-center gap-2"
                            onSelect={() => handleRemoveFromSite(user.id, user.managed_site_ids)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>从本站点移除</span>
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
