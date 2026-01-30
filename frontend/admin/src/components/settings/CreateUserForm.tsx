"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChevronLeft,
  UserPlus,
  Mail,
  Shield,
  Loader2,
  Check
} from "lucide-react"
import { toast } from "sonner"
import { useInviteUser, useSitesList } from "@/hooks"
import { UserRole, type Site } from "@/lib/api-client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CreateUserFormProps {
  onCancel: () => void
  onSuccess: () => void
  fixedSiteId?: number
  fixedSiteName?: string
}

export function CreateUserForm({ onCancel, onSuccess, fixedSiteId, fixedSiteName }: CreateUserFormProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>(UserRole.EDITOR)
  const [selectedSites, setSelectedSites] = useState<number[]>(fixedSiteId ? [fixedSiteId] : [])

  const { data: sites } = useSitesList({ page: 1, size: 100 })
  const inviteUserMutation = useInviteUser()

  const toggleSite = (siteId: number) => {
    setSelectedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    )
  }

  const handleInvite = () => {
    if (!email.trim()) {
      toast.error("请输入邮箱地址")
      return
    }

    inviteUserMutation.mutate({
      email: email.trim(),
      role: role,
      managed_site_ids: role === UserRole.ADMIN ? [] : selectedSites,
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

          onSuccess()
        }
      },
      onError: (error: any) => {
        // Handle 409 Conflict (Email already exists)
        if (error?.status === 409 || error?.body?.code === 409) {
          toast.error("该邮箱已被注册", {
            description: "请使用其他邮箱，或联系管理员重置现有账号。"
          })
          return
        }

        // Handle other errors
        const msg = error?.body?.msg || error?.message || "创建用户失败"
        toast.error(msg)
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10 py-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {fixedSiteName ? `添加成员到 ${fixedSiteName}` : "添加新用户"}
            </h1>
            <p className="text-slate-500 text-xs hidden md:block">
              {fixedSiteName ? `邀请成员加入「${fixedSiteName}」，分配相应的角色和权限。` : "邀请团队成员加入平台，分配相应的角色和权限。"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={inviteUserMutation.isPending}>
            取消
          </Button>
          <Button size="sm" className="flex items-center gap-2" onClick={handleInvite} disabled={inviteUserMutation.isPending}>
            <UserPlus className="h-4 w-4" />
            {inviteUserMutation.isPending ? "创建中..." : "确认添加"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-1">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              账号信息
            </CardTitle>
            <CardDescription className="text-xs">
              设置用户的登录邮箱，系统将自动生成初始密码。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">邮箱地址 <span className="text-red-500">*</span></label>
              <Input
                className="h-9 max-w-md"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              角色权限
            </CardTitle>
            <CardDescription className="text-xs">
              {fixedSiteId ? "设置用户在该站点的访问权限。" : "设置用户在平台级别的访问权限。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${role === UserRole.EDITOR ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                  onClick={() => setRole(UserRole.EDITOR)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">站点编辑</span>
                    {role === UserRole.EDITOR && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    仅可访问和编辑被分配的站点内容。适合普通内容创作者。
                  </p>
                </div>

                <div
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${role === UserRole.SITE_ADMIN ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                  onClick={() => setRole(UserRole.SITE_ADMIN)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">站点管理员</span>
                    {role === UserRole.SITE_ADMIN && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    可以管理被分配站点的所有内容和设置。适合站点负责人。
                  </p>
                </div>

                {!fixedSiteId && (
                  <div
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${role === UserRole.ADMIN ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                    onClick={() => setRole(UserRole.ADMIN)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">系统管理员</span>
                      {role === UserRole.ADMIN && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      拥有全平台最高权限，可管理所有站点、用户和系统配置。
                    </p>
                  </div>
                )}
              </div>
            </div>


            {role !== UserRole.ADMIN && !fixedSiteId && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <label className="text-sm font-medium text-slate-700 block mb-3">
                  分配站点 <span className="text-slate-500 font-normal">({selectedSites.length} 已选)</span>
                </label>

                {(!sites || sites.length === 0) ? (
                  <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center">
                    暂无可用站点，请先创建站点。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {sites.map((site: Site) => (
                      <div
                        key={site.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedSites.includes(site.id) ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => toggleSite(site.id)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedSites.includes(site.id) ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                          {selectedSites.includes(site.id) && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{site.name}</div>
                          <div className="text-xs text-slate-500 truncate">{site.domain || "无域名"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  选择该用户可以{role === UserRole.SITE_ADMIN ? "管理" : "编辑"}的站点。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div >
  )
}
