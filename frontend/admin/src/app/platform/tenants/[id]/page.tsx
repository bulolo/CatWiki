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
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChevronLeft,
  Save,
  Building2,
  Settings,
  ShieldCheck,
  CreditCard,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api-client"

export default function EditTenantPage() {
  const router = useRouter()
  const params = useParams()
  const id = parseInt(params.id as string)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [plan, setPlan] = useState("starter")
  const [status, setStatus] = useState("active")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const tenant = await api.tenant.get(id)
        setName(tenant.name)
        setSlug(tenant.slug)
        setDescription(tenant.description || "")
        setPlan(tenant.plan)
        setStatus(tenant.status)
      } catch (error) {
        console.error("Failed to fetch tenant:", error)
        toast.error("加载租户数据失败")
        router.push("/platform/tenants")
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchTenant()
    }
  }, [id, router])

  const handleBack = () => {
    router.push("/platform/tenants")
  }

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error("请输入租户名称")
      return
    }
    if (!slug.trim()) {
      toast.error("请输入租户标识")
      return
    }

    setIsSubmitting(true)
    try {
      await api.tenant.update(id, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        plan: plan,
        status: status
      })
      toast.success("租户更新成功")
      router.push("/platform/tenants")
    } catch (error) {
      console.error("Failed to update tenant:", error)
      toast.error("租户更新失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-slate-500">加载租户数据中...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">编辑租户</h1>
            <p className="text-slate-500 text-sm">修改租户的基本信息、服务套餐和运行状态。</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
            取消
          </Button>
          <Button className="flex items-center gap-2" onClick={handleUpdate} disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "保存中..." : "保存变更"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              身份信息
            </CardTitle>
            <CardDescription>
              设置租户的核心身份标识和描述。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">租户名称 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="例如：阿特拉斯科技"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">租户唯一标识 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="例如：atlas"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <p className="text-xs text-slate-500">修改标识可能会影响该租户下某些基于 Slug 的链接。</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">描述</label>
              <Textarea
                placeholder="简要介绍这个租户..."
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
                <CreditCard className="h-4 w-4 text-primary" />
                套餐方案
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {['starter', 'professional', 'enterprise'].map((p) => (
                  <div
                    key={p}
                    className={`border rounded-lg p-3 text-center text-xs font-medium cursor-pointer transition-colors ${plan === p
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    onClick={() => setPlan(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                运行状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'active', label: '运行中', color: 'bg-emerald-500' },
                  { id: 'trial', label: '试用中', color: 'bg-blue-500' },
                  { id: 'disabled', label: '已禁用', color: 'bg-red-500' },
                ].map((s) => (
                  <div
                    key={s.id}
                    className={`border rounded-lg p-3 flex flex-col items-center gap-2 cursor-pointer transition-colors ${status === s.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    onClick={() => setStatus(s.id)}
                  >
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-xs font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
