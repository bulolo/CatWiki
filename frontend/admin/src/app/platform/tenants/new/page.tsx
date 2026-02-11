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

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  CreditCard
} from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api-client"
import { addYears } from "date-fns"

export default function NewTenantPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [plan, setPlan] = useState("starter")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBack = () => {
    router.push("/platform/tenants")
  }

  const handleCreate = async () => {
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
      await api.tenant.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        plan: plan,
        status: "trial",
        plan_expires_at: addYears(new Date(), 1).toISOString(),
        max_sites: 3,
        max_documents: 1000,
        max_storage_mb: 5120,
        max_users: 10
      })
      toast.success("租户创建成功")
      router.push("/platform/tenants")
    } catch (error) {
      console.error("Failed to create tenant:", error)
      toast.error("租户创建失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">创建新租户</h1>
            <p className="text-slate-500 text-sm">为新的企业或部门创建一个独立的管理域。</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
            取消
          </Button>
          <Button className="flex items-center gap-2" onClick={handleCreate} disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "创建中..." : "完成创建"}
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
                <p className="text-xs text-slate-500">仅支持小写字母、数字和连字符。</p>
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
                资源限制 (默认)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <div className="flex justify-between">
                <span>最大站点数</span>
                <span className="font-medium text-slate-900">3</span>
              </div>
              <div className="flex justify-between">
                <span>最大文档数</span>
                <span className="font-medium text-slate-900">1000</span>
              </div>
              <div className="flex justify-between">
                <span>存储空间</span>
                <span className="font-medium text-slate-900">5GB</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
