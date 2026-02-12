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

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Building2,
  Plus,
  Search,
  Users,
  Globe,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  Edit,
  Disc,
  ArrowLeft,
  Info,
  UserCog,
  CreditCard,
  HardDrive,
  Mail,
  Phone,
  Calendar, // Ensure all imports from SaaS are present
  Settings,
  ShieldCheck,
  X, // Imports for wrapper
  FileText, // Added for new tabs
  CircuitBoard
} from "lucide-react"
// import { useTenantContext } from "@/components/layout/TenantSwitcher" // SaaS context not available locally
import { api, Models, UserRole } from "@/lib/api-client" // Added UserRole for wrapper check
import { getUserInfo, setSelectedTenantId } from "@/lib/auth" // For wrapper check and context switch
import { SettingsProvider } from "@/contexts/SettingsContext"
import { DocProcessorSettings } from "@/components/settings/doc-processor/DocProcessorSettings"
import { ModelSettingsCard } from "@/components/settings/models/ModelSettingsCard"
import { ModelDetailCard } from "@/components/settings/models/ModelDetailCard"
import { type ModelType } from "@/types/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/ui/ImageUpload"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
// Wrapper imports
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

// ==================== Type Adaptations for Local SDK Compatibility ====================
// Adapting SaaS types to current main branch SDK generated types
type Tenant = Models.TenantSchema

// Models.TenantStatus is missing in local SDK, defining it locally to match SaaS enum usage
enum TenantStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive'
}

// ==================== 1:1 SaaS PlatformTenants Component Content ====================

// 状态颜色映射
const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  trial: "bg-amber-100 text-amber-700 border-amber-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
}

const planColors: Record<string, string> = {
  starter: "bg-slate-100 text-slate-600",
  pro: "bg-blue-100 text-blue-600",
  custom: "bg-purple-100 text-purple-600",
}

// 订阅计划配置 - 不同计划对应不同资源配额
const PLAN_CONFIGS: Record<string, { name: string; max_sites: number; max_documents: number; max_storage_mb: number; max_users: number }> = {
  starter: {
    name: "入门版",
    max_sites: 3,
    max_documents: 100,
    max_storage_mb: 1024, // 1GB
    max_users: 5,
  },
  pro: {
    name: "专业版",
    max_sites: 10,
    max_documents: 500,
    max_storage_mb: 10240, // 10GB
    max_users: 20,
  },
  custom: {
    name: "自定义",
    max_sites: -1, // -1 表示手动输入，不自动填充
    max_documents: -1,
    max_storage_mb: -1,
    max_users: -1,
  },
}

import { useQueryClient } from "@tanstack/react-query"

type ViewState = 'list' | 'create' | 'edit'

function PlatformTenants() {
  const router = useRouter()
  const queryClient = useQueryClient() // Initialize queryClient
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState<Tenant[]>([]) // Use adapted type
  const [searchQuery, setSearchQuery] = useState("")

  // Data invalidation helper
  const invalidateTenants = () => {
    queryClient.invalidateQueries({ queryKey: ['tenants'] })
  }

  // 视图状态
  const [view, setView] = useState<ViewState>('list')

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    logo_url: "",
    admin_email: "",
    admin_password: "",
    plan: "starter",
    status: TenantStatus.ACTIVE, // Use local enum
    max_sites: PLAN_CONFIGS.starter.max_sites,
    max_documents: PLAN_CONFIGS.starter.max_documents,
    max_storage_mb: PLAN_CONFIGS.starter.max_storage_mb,
    max_users: PLAN_CONFIGS.starter.max_users,
    contact_email: "",
    contact_phone: "",
    admin_name: "",
    plan_expires_at: "",
    platform_resources_allowed: [] as string[],
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: "",
    slug: "",
    domain: "",
    description: "",
    logo_url: "",
    status: TenantStatus.ACTIVE, // Use local enum
    plan: "starter",
    plan_expires_at: "",
    max_sites: PLAN_CONFIGS.starter.max_sites,
    max_documents: PLAN_CONFIGS.starter.max_documents,
    max_storage_mb: PLAN_CONFIGS.starter.max_storage_mb,
    max_users: PLAN_CONFIGS.starter.max_users,
    contact_email: "",
    contact_phone: "",
    platform_resources_allowed: [] as string[],
  })

  // 跟踪用户是否手动编辑过 slug
  const slugManuallyEdited = useRef(false)

  // 生成 slug 的辅助函数
  const generateSlugFromName = (name: string): string => {
    let slug = name
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5-]/g, '') // 保留中文、字母、数字、空格、连字符
      .replace(/[\u4e00-\u9fa5]+/g, (match) => {
        // 对于中文字符，取首字母缩写（简化处理）
        // 由于没有 pinyin 库，暂时生成随机后缀
        return ''
      })
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-|-$/g, '') // 移除首尾连字符

    // 如果结果为空（如纯中文名称），生成随机 ID
    if (!slug) {
      const randomId = Math.random().toString(36).substring(2, 8)
      slug = `tenant-${randomId}`
    }

    return slug
  }

  // 自动生成 slug - 使用防抖，等待用户停止输入后再生成（支持中文输入）
  useEffect(() => {
    if (view !== 'create') return
    if (!formData.name) return
    if (slugManuallyEdited.current) return // 用户手动编辑过，不再自动生成

    // 防抖：500ms 后生成 slug
    const timer = setTimeout(() => {
      const generatedSlug = generateSlugFromName(formData.name)
      setFormData(prev => ({ ...prev, slug: generatedSlug }))
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name, view])


  // 上下文切换
  const switchToTenant = (tenantId: number) => {
    // SaaS logic:
    // localStorage.setItem('admin_tenant_context', String(tenantId))
    // localStorage.removeItem('lastSiteSlug')
    // window.location.href = '/'

    // Local logic (using auth lib helpers if available, but stick to SaaS logic if "exact"):
    // SaaS logic relies on localStorage. Local backend/frontend might use different key?
    // Step 855 api-client.ts uses `getSelectedTenantId`.
    // Let's use the local `setSelectedTenantId` helper to match local auth system, but keep the flow.
    setSelectedTenantId(tenantId)
    localStorage.removeItem('lastSiteSlug')
    window.location.href = '/'
  }

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const res = await api.tenant.list({ size: 100 }) // 获取足够多的租户
      setTenants(res.list)
    } catch (error: any) {
      toast.error(error.message || "获取租户列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      if (!formData.name || !formData.slug || !formData.admin_email || !formData.admin_password || !formData.plan_expires_at) {
        toast.error("请填写必要信息（包括订阅到期时间）")
        return
      }

      await api.tenant.create({
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        logo_url: formData.logo_url || undefined,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
        admin_name: (formData as any).admin_name || undefined,
        plan: formData.plan,
        status: formData.status as any, // Cast to any to avoid enum mismatch
        max_sites: Number(formData.max_sites),
        max_documents: Number(formData.max_documents),
        max_storage_mb: Number(formData.max_storage_mb),
        max_users: Number(formData.max_users),
        contact_email: formData.contact_email || undefined,
        contact_phone: formData.contact_phone || undefined,
        plan_expires_at: new Date(formData.plan_expires_at).toISOString(),
        platform_resources_allowed: formData.platform_resources_allowed,
      } as any)

      toast.success("租户创建成功")
      setView('list')
      fetchTenants()
      invalidateTenants() // 刷新全局租户选择器
      // 重置表单
      slugManuallyEdited.current = false
      setFormData({
        name: "",
        slug: "",
        description: "",
        logo_url: "",
        admin_email: "",
        admin_password: "",
        plan: "starter",
        status: TenantStatus.ACTIVE,
        max_sites: PLAN_CONFIGS.starter.max_sites,
        max_documents: PLAN_CONFIGS.starter.max_documents,
        max_storage_mb: PLAN_CONFIGS.starter.max_storage_mb,
        max_users: PLAN_CONFIGS.starter.max_users,
        contact_email: "",
        contact_phone: "",
        admin_name: "",
        plan_expires_at: "",
        platform_resources_allowed: [],
      })
    } catch (error: any) {
      toast.error(error.message || "创建失败")
    }
  }

  const handleUpdate = async () => {
    if (!editingTenant) return
    try {
      if (!editFormData.name || !editFormData.plan_expires_at) {
        toast.error("名称和订阅到期时间为必填项")
        return
      }

      await api.tenant.update(editingTenant.id, {
        name: editFormData.name,
        domain: editFormData.domain || undefined,
        description: editFormData.description || undefined,
        logo_url: editFormData.logo_url || undefined,
        status: editFormData.status,
        plan: editFormData.plan,
        plan_expires_at: editFormData.plan_expires_at || undefined,
        max_sites: Number(editFormData.max_sites),
        max_documents: Number(editFormData.max_documents),
        max_storage_mb: Number(editFormData.max_storage_mb),
        max_users: Number(editFormData.max_users),
        contact_email: editFormData.contact_email || undefined,
        contact_phone: editFormData.contact_phone || undefined,
        platform_resources_allowed: editFormData.platform_resources_allowed,
      } as any)
      toast.success("更新成功")
      setView('list')
      fetchTenants()
      invalidateTenants() // 刷新全局租户选择器
    } catch (error: any) {
      toast.error(error.message || "更新失败")
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.tenant.update(id, { status } as any)
      toast.success("状态已更新")
      fetchTenants()
      invalidateTenants() // 刷新全局租户选择器
    } catch (error: any) {
      toast.error(error.message || "更新失败")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除该租户吗？此操作不可恢复！")) return

    try {
      await api.tenant.delete(id)
      toast.success("租户已删除")
      fetchTenants()
      invalidateTenants() // 刷新全局租户选择器
    } catch (error: any) {
      toast.error(error.message || "删除失败")
    }
  }

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeTenantsCount = tenants.filter(t => t.status === TenantStatus.ACTIVE).length

  // Render List View
  if (view === 'list') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* 头部统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">总租户数</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{tenants.length}</p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">活跃租户</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">
                    {activeTenantsCount}
                  </p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Play className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">总存储配额</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">
                    {Math.round(tenants.reduce((acc, t) => acc + (t.max_storage_mb || 0), 0) / 1024)} GB
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Disc className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">总用户配额</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">
                    {tenants.reduce((acc, t) => acc + (t.max_users || 0), 0)}
                  </p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 租户列表 */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-bold">租户列表</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="搜索租户..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-56 h-8 text-sm bg-slate-50 border-slate-200"
                />
              </div>
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setView('create')}>
                <Plus className="h-3.5 w-3.5" />
                开通租户
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">加载中...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden relative">
                        {(tenant as any).logo_url ? (
                          <Image
                            src={(tenant as any).logo_url}
                            alt={tenant.name || 'Tenant Logo'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <Building2 className="h-4.5 w-4.5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 truncate max-w-[200px]" title={tenant.name}>
                            {tenant.name}
                          </span>
                          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-bold", statusColors[tenant.status || 'inactive'] || "bg-slate-100")}>
                            {tenant.status === 'active' ? '活跃' :
                              tenant.status === 'trial' ? '试用' :
                                tenant.status === 'suspended' ? '暂停' : '未激活'}
                          </Badge>
                          <Badge className={cn("text-[10px] h-5 px-1.5 font-bold", planColors[tenant.plan || 'free'] || "bg-slate-100")}>
                            {(tenant.plan || 'free').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-slate-400">{tenant.slug}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>开通: {new Date(tenant.created_at).toLocaleDateString('zh-CN')}</span>
                          {(tenant as any).plan_expires_at && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>到期: {new Date((tenant as any).plan_expires_at).toLocaleDateString('zh-CN')}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5" title="最大站点数">
                          <Globe className="h-3.5 w-3.5 opacity-70" />
                          <span className="font-mono">{tenant.max_sites}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="最大用户数">
                          <Users className="h-3.5 w-3.5 opacity-70" />
                          <span className="font-mono">{tenant.max_users}</span>
                        </div>
                      </div>

                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 z-[200]">
                          <DropdownMenuItem className="gap-2" onClick={() => {
                            setEditingTenant(tenant)
                            setEditFormData({
                              name: tenant.name,
                              slug: tenant.slug || "",
                              domain: (tenant as any).domain || "",
                              description: (tenant as any).description || "",
                              logo_url: (tenant as any).logo_url || "",
                              status: (tenant.status as TenantStatus) || TenantStatus.ACTIVE,
                              plan: tenant.plan || "free",
                              plan_expires_at: (tenant as any).plan_expires_at ? new Date((tenant as any).plan_expires_at).toISOString().split('T')[0] : "",
                              max_sites: tenant.max_sites || 0,
                              max_documents: (tenant as any).max_documents || 1000,
                              max_storage_mb: tenant.max_storage_mb || 0,
                              max_users: tenant.max_users || 0,
                              contact_email: (tenant as any).contact_email || "",
                              contact_phone: (tenant as any).contact_phone || "",
                              platform_resources_allowed: (tenant as any).platform_resources_allowed || [],
                            })
                            setView('edit')
                          }}>
                            <Edit className="h-4 w-4" />
                            编辑租户
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => switchToTenant(tenant.id)}>
                            <Users className="h-4 w-4" />
                            切换到此租户
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenant.status === TenantStatus.ACTIVE ? (
                            <DropdownMenuItem
                              className="gap-2 text-amber-600 focus:text-amber-700 focus:bg-amber-50"
                              onClick={() => handleUpdateStatus(tenant.id, TenantStatus.SUSPENDED)}
                            >
                              <Pause className="h-4 w-4" />
                              暂停租户
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="gap-2 text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              onClick={() => handleUpdateStatus(tenant.id, TenantStatus.ACTIVE)}
                            >
                              <Play className="h-4 w-4" />
                              激活租户
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                            onClick={() => handleDelete(tenant.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            删除租户
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}

                {filteredTenants.length === 0 && (
                  <div className="px-6 py-16 text-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                      <Building2 className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-900">暂无租户</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                      {searchQuery ? "没有找到匹配的租户" : "点击右上角按钮开通您的第一个租户"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render Create/Edit View
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* 增强的页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView('list')} className="h-9 w-9 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-2 rounded-lg border",
                view === 'create'
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-blue-50 text-blue-600 border-blue-100"
              )}>
                {view === 'create' ? (
                  <Plus className="h-5 w-5" />
                ) : (
                  <Edit className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {view === 'create' ? '开通新租户' : '编辑租户信息'}
                </h2>
                <p className="text-xs text-slate-500">
                  {view === 'create'
                    ? '创建一个新的企业租户，并设置初始管理员账户'
                    : `正在编辑: ${editingTenant?.name} (${editingTenant?.slug})`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          {view === 'create' ? (
            <div className="grid gap-5">
              {/* 基础信息 */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">基础信息</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">租户名称 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="例如：Acme Corp"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">标识 (Slug) <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="(自动生成)"
                      value={formData.slug}
                      onChange={(e) => {
                        slugManuallyEdited.current = true
                        setFormData({ ...formData, slug: e.target.value })
                      }}
                      className="bg-white font-mono"
                    />
                    <p className="text-[10px] text-slate-400">只允许小写字母、数字和连字符</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">企业描述 <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                    <Textarea
                      placeholder="请输入企业描述..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="bg-white resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">企业 Logo <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                    <div className="w-28">
                      <ImageUpload
                        value={formData.logo_url}
                        onChange={(url) => setFormData({ ...formData, logo_url: url || "" })}
                        aspect="aspect-square"
                        text="上传 Logo"
                        compact={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 初始管理员 */}
              <div className="p-5 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-xl border border-amber-200/60 shadow-sm">
                <div className="flex items-start gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center mt-0.5">
                    <UserCog className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">初始管理员</h3>
                    <p className="text-xs text-slate-500 mt-0.5">设置该租户的初始管理员账户。</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">管理员邮箱 <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">管理员密码 <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      placeholder="至少6位"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">管理员姓名 <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                    <Input
                      placeholder="例如：张三"
                      value={(formData as any).admin_name || ""}
                      onChange={(e) => setFormData({ ...formData, admin_name: e.target.value } as any)}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 订阅与状态 */}
              <div className="p-5 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 rounded-xl border border-purple-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">订阅与状态</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">订阅计划 <span className="text-red-500">*</span></Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      value={formData.plan}
                      onChange={(e) => {
                        const plan = e.target.value
                        const config = PLAN_CONFIGS[plan]
                        if (config && plan !== 'custom') {
                          setFormData({
                            ...formData,
                            plan,
                            max_sites: config.max_sites > 0 ? config.max_sites : formData.max_sites,
                            max_documents: config.max_documents > 0 ? config.max_documents : formData.max_documents,
                            max_storage_mb: config.max_storage_mb > 0 ? config.max_storage_mb : formData.max_storage_mb,
                            max_users: config.max_users > 0 ? config.max_users : formData.max_users,
                          })
                        } else {
                          setFormData({ ...formData, plan })
                        }
                      }}
                    >
                      <option value="starter">入门版</option>
                      <option value="pro">专业版</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">租户状态 <span className="text-red-500">*</span></Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TenantStatus })}
                    >
                      <option value={TenantStatus.ACTIVE}>活跃</option>
                      <option value={TenantStatus.TRIAL}>试用</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">订阅到期时间 <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.plan_expires_at}
                      onChange={(e) => setFormData({ ...formData, plan_expires_at: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>

                {/* 平台资源授权 ( granular ) */}
                <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">模型配置 (Models)</Label>
                      <p className="text-[11px] text-slate-500">允许此租户所有站点使用平台公共的 AI 模型</p>
                    </div>
                    <Switch
                      checked={formData.platform_resources_allowed.includes('models')}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...formData.platform_resources_allowed, 'models']
                          : formData.platform_resources_allowed.filter(r => r !== 'models')
                        setFormData({ ...formData, platform_resources_allowed: next })
                      }}
                    />
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">文档解析 (Document Parsing)</Label>
                      <p className="text-[11px] text-slate-500">允许此租户所有站点使用平台公共的解析器资源</p>
                    </div>
                    <Switch
                      checked={formData.platform_resources_allowed.includes('doc_processors')}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...formData.platform_resources_allowed, 'doc_processors']
                          : formData.platform_resources_allowed.filter(r => r !== 'doc_processors')
                        setFormData({ ...formData, platform_resources_allowed: next })
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 资源配额 */}
              <div className="p-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 rounded-xl border border-emerald-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <HardDrive className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">资源配额</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大站点</Label>
                    <Input
                      type="number"
                      value={formData.max_sites}
                      onChange={(e) => setFormData({ ...formData, max_sites: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">总文档数</Label>
                    <Input
                      type="number"
                      value={formData.max_documents}
                      onChange={(e) => setFormData({ ...formData, max_documents: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大存储 (MB)</Label>
                    <Input
                      type="number"
                      value={formData.max_storage_mb}
                      onChange={(e) => setFormData({ ...formData, max_storage_mb: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大用户</Label>
                    <Input
                      type="number"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="p-5 bg-gradient-to-br from-cyan-50/50 to-sky-50/30 rounded-xl border border-cyan-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-cyan-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">联系信息 <span className="text-slate-400 text-xs font-normal">(选填)</span></h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">联系邮箱</Label>
                    <Input
                      type="email"
                      placeholder="contact@example.com"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">联系电话</Label>
                    <Input
                      type="tel"
                      placeholder="+86 xxx xxxx xxxx"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400"><span className="text-red-500">*</span> 为必填项</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setView('list')}>取消</Button>
                  <Button onClick={handleCreate}>创建租户</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              {/* 基本信息 */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">基本信息</h3>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">标识 (Slug) <span className="text-slate-400 text-xs font-normal">(只读)</span></Label>
                    <Input
                      value={editFormData.slug}
                      disabled
                      className="bg-slate-100 text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">租户名称 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="租户名称"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">自定义域名 <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                    <Input
                      placeholder="例如：company.example.com"
                      value={editFormData.domain}
                      onChange={(e) => setEditFormData({ ...editFormData, domain: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">企业 Logo <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                    <div className="w-28">
                      <ImageUpload
                        value={editFormData.logo_url}
                        onChange={(url) => setEditFormData({ ...editFormData, logo_url: url || "" })}
                        aspect="aspect-square"
                        text="上传 Logo"
                        compact={true}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600">企业描述 <span className="text-slate-400 text-xs font-normal">(选填)</span></Label>
                  <Textarea
                    placeholder="请输入企业描述..."
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={2}
                    className="bg-white resize-none"
                  />
                </div>
              </div>

              {/* 订阅与状态 */}
              <div className="p-5 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 rounded-xl border border-purple-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">订阅与状态</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">订阅计划 <span className="text-red-500">*</span></Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      value={editFormData.plan}
                      onChange={(e) => {
                        const plan = e.target.value
                        const config = PLAN_CONFIGS[plan]
                        if (config && plan !== 'custom') {
                          setEditFormData({
                            ...editFormData,
                            plan,
                            max_sites: config.max_sites > 0 ? config.max_sites : editFormData.max_sites,
                            max_documents: config.max_documents > 0 ? config.max_documents : editFormData.max_documents,
                            max_storage_mb: config.max_storage_mb > 0 ? config.max_storage_mb : editFormData.max_storage_mb,
                            max_users: config.max_users > 0 ? config.max_users : editFormData.max_users,
                          })
                        } else {
                          setEditFormData({ ...editFormData, plan })
                        }
                      }}
                    >
                      <option value="starter">入门版</option>
                      <option value="pro">专业版</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">租户状态 <span className="text-red-500">*</span></Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as TenantStatus })}
                    >
                      <option value={TenantStatus.ACTIVE}>活跃</option>
                      <option value={TenantStatus.TRIAL}>试用</option>
                      <option value={TenantStatus.SUSPENDED}>暂停</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">订阅到期时间 <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={editFormData.plan_expires_at}
                      onChange={(e) => setEditFormData({ ...editFormData, plan_expires_at: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>

                {/* 平台资源授权 ( granular ) */}
                <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">模型配置 (Models)</Label>
                      <p className="text-[11px] text-slate-500">允许此租户所有站点使用平台公共的 AI 模型</p>
                    </div>
                    <Switch
                      checked={editFormData.platform_resources_allowed.includes('models')}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...editFormData.platform_resources_allowed, 'models']
                          : editFormData.platform_resources_allowed.filter(r => r !== 'models')
                        setEditFormData({ ...editFormData, platform_resources_allowed: next })
                      }}
                    />
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">文档解析 (Document Parsing)</Label>
                      <p className="text-[11px] text-slate-500">允许此租户所有站点使用平台公共的解析器资源</p>
                    </div>
                    <Switch
                      checked={editFormData.platform_resources_allowed.includes('doc_processors')}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...editFormData.platform_resources_allowed, 'doc_processors']
                          : editFormData.platform_resources_allowed.filter(r => r !== 'doc_processors')
                        setEditFormData({ ...editFormData, platform_resources_allowed: next })
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 资源配额 */}
              <div className="p-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 rounded-xl border border-emerald-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <HardDrive className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">资源配额</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大站点</Label>
                    <Input
                      type="number"
                      value={editFormData.max_sites}
                      onChange={(e) => setEditFormData({ ...editFormData, max_sites: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">总文档数</Label>
                    <Input
                      type="number"
                      value={editFormData.max_documents}
                      onChange={(e) => setEditFormData({ ...editFormData, max_documents: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大存储 (MB)</Label>
                    <Input
                      type="number"
                      value={editFormData.max_storage_mb}
                      onChange={(e) => setEditFormData({ ...editFormData, max_storage_mb: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">最大用户</Label>
                    <Input
                      type="number"
                      value={editFormData.max_users}
                      onChange={(e) => setEditFormData({ ...editFormData, max_users: Number(e.target.value) })}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="p-5 bg-gradient-to-br from-cyan-50/50 to-sky-50/30 rounded-xl border border-cyan-200/60 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-cyan-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">联系信息 <span className="text-slate-400 text-xs font-normal">(选填)</span></h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600">联系邮箱</Label>
                    <Input
                      type="email"
                      placeholder="contact@example.com"
                      value={editFormData.contact_email}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600">联系电话</Label>
                    <Input
                      type="tel"
                      placeholder="+86 xxx xxxx xxxx"
                      value={editFormData.contact_phone}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setView('list')}>取消</Button>
                <Button onClick={handleUpdate}>保存修改</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card >
    </div >
  )
}

// ==================== 1:1 SaaS PlatformModal Wrapper ====================

export function PlatformModal() {
  const userInfo = getUserInfo()
  const isAdmin = userInfo?.role === UserRole.ADMIN

  // Ensure mount to avoid hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isAdmin) return null
  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300">
      <SettingsProvider scope="platform">
        <PlatformModalContent />
      </SettingsProvider>
    </div>
  )
}

function PlatformModalContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("platform")
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null)

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("modal")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSelectModel = (model: ModelType) => {
    setSelectedModel(model)
  }

  const handleBackToModels = () => {
    setSelectedModel(null)
  }

  return (
    <div className="w-full max-w-6xl h-[85vh] min-h-[600px] bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/60 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-500">

      {/* Window Header */}
      <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              平台管理
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Window Body */}
      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <TabsList className="w-64 h-full bg-slate-50/50 border-r border-slate-100 flex-col items-stretch justify-start p-4 space-y-1">
          <TabsTrigger
            value="platform"
            className={cn(
              "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
              "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
              "hover:bg-white/60 hover:text-slate-900 text-slate-500"
            )}
          >
            <Building2 className="h-4 w-4 mr-3 opacity-70" />
            平台租户
          </TabsTrigger>

          <div className="h-px bg-slate-200/60 my-2 mx-2" />

          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            平台资源
          </div>

          <TabsTrigger
            value="doc-processor"
            className={cn(
              "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
              "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
              "hover:bg-white/60 hover:text-slate-900 text-slate-500"
            )}
          >
            <FileText className="h-4 w-4 mr-3 opacity-70" />
            文档解析
          </TabsTrigger>

          <TabsTrigger
            value="models"
            className={cn(
              "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
              "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
              "hover:bg-white/60 hover:text-slate-900 text-slate-500"
            )}
          >
            <CircuitBoard className="h-4 w-4 mr-3 opacity-70" />
            模型配置
          </TabsTrigger>
        </TabsList>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white relative">
          <div className="max-w-4xl mx-auto p-8 h-full">
            <TabsContent value="platform" className="mt-0 h-full space-y-6 outline-none">
              <PlatformTenants />
            </TabsContent>

            <TabsContent value="doc-processor" className="mt-0 h-full space-y-6 outline-none">
              <DocProcessorSettings scope="platform" />
            </TabsContent>

            <TabsContent value="models" className="mt-0 h-full space-y-6 outline-none">
              {selectedModel ? (
                <ModelDetailCard
                  modelType={selectedModel as "chat" | "embedding" | "rerank" | "vl"}
                  onBack={handleBackToModels}
                />
              ) : (
                <ModelSettingsCard
                  // @ts-ignore - mismatch in expected types but functional
                  onSelectModel={handleSelectModel}
                  activeTab={"" as any}
                />
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
