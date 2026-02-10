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

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChevronLeft,
  Save,
  Globe,
  Settings,
  Layout,
  Palette,
  ShieldCheck,
  Users
} from "lucide-react"
import { toast } from "sonner"
import { useCreateSite } from "@/hooks"
import { env } from "@/lib/env"

// 主题色配置
const THEME_COLORS = [
  { value: 'blue', label: '蓝色', className: 'bg-blue-500' },
  { value: 'emerald', label: '绿色', className: 'bg-emerald-500' },
  { value: 'purple', label: '紫色', className: 'bg-purple-500' },
  { value: 'orange', label: '橙色', className: 'bg-orange-500' },
  { value: 'slate', label: '灰色', className: 'bg-slate-800' },
] as const

export default function NewSitePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")
  const [mounted, setMounted] = useState(false)

  // 站点管理员状态
  const [initAdmin, setInitAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用 React Query 创建 hook
  const createSiteMutation = useCreateSite()

  const handleBack = () => {
    router.push("/settings?tab=sites")
  }

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("请输入站点名称")
      return
    }
    if (!slug.trim()) {
      toast.error("请输入站点唯一标识")
      return
    }

    if (initAdmin && !adminEmail.trim()) {
      toast.error("请输入管理员邮箱")
      return
    }

    createSiteMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      status: isActive ? "active" : "disabled",
      theme_color: themeColor,
      layout_mode: layoutMode,
      // 传递管理员信息
      admin_email: initAdmin ? adminEmail.trim() : undefined,
      admin_password: (initAdmin && adminPassword) ? adminPassword : undefined,
    }, {
      onSuccess: () => {
        router.push("/settings?tab=sites")
      }
    })
  }

  if (!mounted) {
    return null // 或者显示一个基础的骨架屏
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">创建新站点</h1>
            <p className="text-slate-500 text-sm">定义一个全新的知识领域，并为它配置唯一的标识和风格。</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleBack} disabled={createSiteMutation.isPending}>
            取消
          </Button>
          <Button className="flex items-center gap-2" onClick={handleCreate} disabled={createSiteMutation.isPending}>
            <Save className="h-4 w-4" />
            {createSiteMutation.isPending ? "创建中..." : "完成创建"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              基本配置
            </CardTitle>
            <CardDescription>
              设置站点的名称、唯一标识等核心信息。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">站点名称</label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="例如：catWiki"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">站点唯一标识</label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 h-10 rounded-l-md border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm">
                    {env.NEXT_PUBLIC_CLIENT_URL}/
                  </span>
                  <input
                    className="flex h-10 w-full rounded-r-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="cat"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-500">此标识将用于访问该 Wiki 站点的 URL 地址。</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">站点描述</label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="简要介绍这个 Wiki 站点的主要内容..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                界面与风格
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">主题色</label>
                <div className="flex gap-2">
                  {THEME_COLORS.map((color) => (
                    <div
                      key={color.value}
                      className={`w-8 h-8 rounded-full ${color.className} cursor-pointer ring-offset-2 transition-all ${themeColor === color.value ? 'ring-2 ring-primary ring-offset-2' : 'hover:ring-2 ring-slate-300'
                        }`}
                      onClick={() => setThemeColor(color.value)}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">布局模式</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`border rounded-lg p-3 text-center text-xs font-medium cursor-pointer transition-colors ${layoutMode === 'sidebar'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    onClick={() => setLayoutMode('sidebar')}
                  >
                    侧边栏目录
                  </div>
                  <div
                    className="border border-slate-200 rounded-lg p-3 text-center text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed opacity-50"
                    title="暂不支持顶部导航"
                  >
                    顶部导航
                  </div>
                </div>
                <p className="text-xs text-slate-500">目前仅支持侧边栏目录布局</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                访问控制
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">启用站点</label>
                  <p className="text-xs text-slate-500">启用后站点将可以正常访问。</p>
                </div>
                <div
                  className={`w-10 h-5 ${isActive ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer`}
                  onClick={() => setIsActive(!isActive)}
                >
                  <div className={`absolute ${isActive ? 'right-0.5' : 'left-0.5'} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
                </div>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">评论功能</label>
                  <p className="text-xs text-slate-500">启用文档下方的用户评论。</p>
                </div>
                <div className="w-10 h-5 bg-slate-200 rounded-full relative cursor-not-allowed">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              站点管理员
            </CardTitle>
            <CardDescription>
              您可以现在指定一个用户作为站点的管理员，或者稍后在站点设置中添加。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-slate-900">初始化管理员</label>
                <p className="text-xs text-slate-500">开启后，可以为新站点创建一个初始管理员账户。</p>
              </div>
              <div
                className={`w-10 h-5 ${initAdmin ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer`}
                onClick={() => setInitAdmin(!initAdmin)}
              >
                <div className={`absolute ${initAdmin ? 'right-0.5' : 'left-0.5'} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
              </div>
            </div>

            {initAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">管理员邮箱 <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="admin@example.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">管理员密码</label>
                  <Input
                    type="text"
                    placeholder="如留空则默认为 123456"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-500">若该邮箱已存在，系统将自动关联无需密码；若为新用户，此密码将作为初始密码。</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <style dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}} />
      </div>
    </div>
  )
}

