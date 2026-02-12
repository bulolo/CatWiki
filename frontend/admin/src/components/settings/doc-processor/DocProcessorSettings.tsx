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
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Loader2,
  Server,
  X,
  Check,
  ExternalLink,
  ShieldCheck,
  Bird,
  Scan,
  BookOpen,
  Pickaxe,
  AlertTriangle,
  Globe
} from "lucide-react"
import { toast } from "sonner"
import {
  type DocProcessorConfig,
  type DocProcessorType,
  DOC_PROCESSOR_TYPES,
  initialDocProcessorConfig
} from "@/types/settings"
import {
  useDocProcessorConfig,
  useUpdateDocProcessorConfig,
  useTestDocProcessorConnection
} from "@/hooks"

export function DocProcessorSettings({ scope = 'tenant' }: { scope?: 'platform' | 'tenant' }) {
  const [processors, setProcessors] = useState<DocProcessorConfig[]>([])
  const [testing, setTesting] = useState<string | null>(null)

  // 内联编辑状态
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<DocProcessorConfig>(initialDocProcessorConfig)

  // 使用 React Query hooks
  const { data: configData, isLoading: loading } = useDocProcessorConfig(scope)
  const updateMutation = useUpdateDocProcessorConfig(scope)
  const testMutation = useTestDocProcessorConnection(scope)

  // 当配置加载完成时，同步到本地 processors 状态
  useEffect(() => {
    if (configData?.processors) {
      setProcessors(configData.processors)
    }
  }, [configData])

  const handleSave = async (updatedProcessors: DocProcessorConfig[]) => {
    // 过滤掉平台资源，只保存租户自定义的
    const tenantProcessors = updatedProcessors.filter(p => p.origin !== 'platform')
    updateMutation.mutate({ processors: tenantProcessors }, {
      onSuccess: () => {
        // 保存成功后，前端状态需要保持合并后的视图 (平台 + 租户)
        // 但由于 updateMutation onSuccess 会触发 invalidateQueries -> useDocProcessorConfig 重新获取
        // 所以这里不需要手动 setProcessors，React Query 会自动更新
      }
    })
  }

  const handleTest = async (processor: DocProcessorConfig) => {
    setTesting(processor.name)
    testMutation.mutate(processor, {
      onSuccess: (response: any) => {
        if (response?.status === "healthy") {
          toast.success(`${processor.name} 连接成功`)
        } else {
          toast.error("连接失败")
        }
      },
      onError: (error: any) => {
        console.error("Test connection failed:", error)
        toast.error("连接测试失败")
      },
      onSettled: () => {
        setTesting(null)
      }
    })
  }

  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setFormData(initialDocProcessorConfig)
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setIsAdding(false)
    setFormData({ ...processors[index] })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingIndex(null)
    setFormData(initialDocProcessorConfig)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("请输入服务名称")
      return
    }
    if (!formData.baseUrl.trim()) {
      toast.error("请输入 API 端点")
      return
    }

    let updated: DocProcessorConfig[]
    if (editingIndex !== null) {
      // 编辑模式
      updated = processors.map((p, i) => i === editingIndex ? formData : p)
    } else {
      // 新增模式
      if (processors.some(p => p.name === formData.name)) {
        toast.error("服务名称已存在")
        return
      }
      updated = [...processors, formData]
    }

    handleSave(updated)
    handleCancel()
  }

  const handleDelete = (processorName: string) => {
    const updated = processors.filter(p => p.name !== processorName)
    handleSave(updated)
  }

  const handleToggleEnabled = (processorName: string, enabled: boolean) => {
    const updated = processors.map(p =>
      p.name === processorName ? { ...p, enabled } : p
    )
    handleSave(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // 内联编辑表单
  const renderForm = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {editingIndex !== null ? "编辑解析器" : "添加解析器"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled" className="text-sm font-medium cursor-pointer">启用此服务</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                placeholder="例如：文档解析器"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={editingIndex !== null}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
              <Select
                value={formData.type}
                onValueChange={(value: DocProcessorType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_PROCESSOR_TYPES.map((type) => {
                    const icons: Record<string, any> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
                    const Icon = icons[type.icon] || FileText
                    return (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        disabled={type.disabled}
                      >
                        <div className="flex items-center gap-2">
                          {type.icon.startsWith('/') ? (
                            <Image src={type.icon} alt="" width={16} height={16} className="object-contain" />
                          ) : (
                            <Icon className={`h-4 w-4 ${type.color.split(' ')[0] || "text-slate-500"}`} />
                          )}
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {/* 显示当前选中类型的说明和文档链接 */}
              {(() => {
                const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
                if (selectedType) {
                  return (
                    <p className="text-xs text-slate-500">
                      {selectedType.description}
                      {selectedType.docUrl && (
                        <>
                          {" · "}
                          <a
                            href={selectedType.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            部署文档 <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </p>
                  )
                }
                return null
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">API 地址 (Base URL)</Label>
            <Input
              id="baseUrl"
              placeholder="例如：http://localhost:8000"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            />
            {(() => {
              const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
              if (selectedType) {
                return (
                  <p className="text-xs text-slate-500">
                    接口调用路径: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{selectedType.endpoint}</code>
                  </p>
                )
              }
            })()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {formData.type === 'Docling' ? 'API 密钥 (X-Api-Key)' : 'API 密钥'}
              <span className="text-slate-400 font-normal ml-1">（可选）</span>
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={formData.type === 'Docling' ? "请输入 X-Api-Key" : "如果需要认证，请输入密钥"}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
          </div>

          {/* 特定配置区域 */}
          {(formData.type === "Docling" || formData.type === "MinerU" || formData.type === "PaddleOCR") && (
            <div className="bg-white/50 rounded-lg p-4 border border-primary/10 space-y-3">
              <Label className="text-xs font-medium text-primary/80 uppercase tracking-wider">处理能力配置</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_ocr"
                    checked={formData.config?.is_ocr || false}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, is_ocr: checked }
                      })
                    }
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="is_ocr" className="text-sm">OCR识别</Label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="extract_images"
                    checked={formData.config?.extract_images ?? false}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, extract_images: checked }
                      })
                    }
                  />
                  <Label htmlFor="extract_images" className="text-sm">提取图片</Label>
                </div>

                {formData.type === "Docling" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="extract_tables"
                      checked={formData.config?.extract_tables ?? false}
                      onCheckedChange={(checked: boolean) =>
                        setFormData({
                          ...formData,
                          config: { ...formData.config, extract_tables: checked }
                        })
                      }
                    />
                    <Label htmlFor="extract_tables" className="text-sm">表格识别</Label>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div >
  )

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">文档解析</h2>
              <p className="text-sm text-slate-500 font-medium">配置可用的文档解析 API，实际使用时可选择。</p>
            </div>
          </div>
          {!isAdding && editingIndex === null && (
            <Button onClick={handleStartAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              添加解析器
            </Button>
          )}
        </div>


        {/* 添加表单 */}
        {isAdding && renderForm()}

        {/* Processor List */}
        {processors.length === 0 && !isAdding ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">暂无配置的文档解析服务</p>
              <Button variant="outline" onClick={handleStartAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                添加第一个解析器
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {processors.map((processor, index) => (
              editingIndex === index ? (
                <div key={processor.name}>{renderForm()}</div>
              ) : (
                <Card key={processor.name} className={`transition-all ${!processor.enabled ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const typeInfo = DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)
                          const icons: Record<string, any> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }

                          if (typeInfo?.icon.startsWith('/')) {
                            return (
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center p-1.5 ${typeInfo?.color || "bg-slate-100"}`}>
                                <Image src={typeInfo.icon} alt={processor.name} width={28} height={28} className="object-contain" />
                              </div>
                            )
                          }

                          const Icon = typeInfo ? icons[typeInfo.icon] || FileText : FileText
                          return (
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${typeInfo?.color || "bg-slate-100 text-slate-600"}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                          )
                        })()}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{processor.name}</CardTitle>
                            {processor.origin === 'platform' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                <Globe className="h-3 w-3 mr-1" />
                                平台共享
                              </span>
                            )}
                          </div>
                          <CardDescription>
                            {DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)?.label || processor.type}
                            {" · "}
                            {processor.baseUrl}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {processor.origin !== 'platform' && (
                          <Switch
                            checked={processor.enabled}
                            onCheckedChange={(checked: boolean) => handleToggleEnabled(processor.name, checked)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTest(processor)}
                          disabled={testing === processor.name}
                        >
                          {testing === processor.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex items-center gap-2" title={processor.origin === 'platform' ? "平台级资源，不可修改" : undefined}>
                          {processor.origin !== 'platform' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(index)}
                                // 只有租户自身的才禁用
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(processor.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
