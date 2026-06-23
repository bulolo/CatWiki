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

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch, useConfirm } from "@/components/ui"
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Loader2,
  Server,
  Bird,
  Scan,
  BookOpen,
  Pickaxe,
  Globe
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  type DocProcessorConfig,
  DOC_PROCESSOR_TYPES,
  initialDocProcessorConfig
} from "@/types/settings"
import { useDocProcessorConfig, useUpdateDocProcessorConfig, useTestDocProcessorConnection } from "@/hooks"
import { DocProcessorForm } from "./_form/DocProcessorForm"

export function DocProcessorSettings({ scope = "tenant" }: { scope?: "platform" | "tenant" }) {
  const t = useTranslations("DocProcessor")
  const confirm = useConfirm()
  const [processors, setProcessors] = useState<DocProcessorConfig[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const [versions, setVersions] = useState<Record<string, string>>({})

  // 内联编辑状态
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<DocProcessorConfig>(initialDocProcessorConfig)

  // 使用 React Query hooks
  const { data: configData, isLoading: loading } = useDocProcessorConfig(scope)
  const updateMutation = useUpdateDocProcessorConfig(scope)
  const testMutation = useTestDocProcessorConnection(scope)

  // 使用 ref 稳定 testMutation 引用，避免下方加载 useEffect 因 testMutation 变化而无限循环。
  // latest-ref 模式：在 effect 中更新（而非 render 期），满足 react-hooks/refs 规则。
  const testMutationRef = useRef(testMutation)
  useEffect(() => {
    testMutationRef.current = testMutation
  })

  // 当配置加载完成时，同步到本地 processors 状态并自动获取版本
  useEffect(() => {
    if (configData?.processors) {
      const list = configData.processors.map(p => ({
        ...p,
        id: p.id || ""
      } as DocProcessorConfig))
      setProcessors(list)

      list.filter(p => p.enabled).forEach(p => {
        testMutationRef.current.mutateAsync(p)
          .then((res: unknown) => {
            const version = (res as { version?: string })?.version
            if (version) setVersions(prev => ({ ...prev, [p.id]: version }))
          })
          .catch(() => {})
      })
    }
  }, [configData])

  const handleSave = async (updatedProcessors: DocProcessorConfig[]) => {
    // 过滤掉平台资源，只保存租户自定义的
    const tenantProcessors = updatedProcessors.filter(p => p.origin !== "platform")
    updateMutation.mutate({ processors: tenantProcessors }, {
      onSuccess: () => {
        toast.success(t("saveSuccess"))
        // 保存成功后，前端状态需要保持合并后的视图 (平台 + 租户)
        // 但由于 updateMutation onSuccess 会触发 invalidateQueries -> useDocProcessorConfig 重新获取
        // 所以这里不需要手动 setProcessors，React Query 会自动更新
      }
    })
  }

  const handleTest = async (processor: DocProcessorConfig) => {
    setTesting(processor.id)
    testMutation.mutate(processor, {
      onSuccess: (response: unknown) => {
        const res = response as { status?: string; version?: string } | undefined
        if (res?.status === "healthy") {
          const versionStr = res.version ? ` v${res.version}` : ""
          toast.success(`${processor.name}${versionStr} ${t("testSuccess")}`)
          if (res.version) setVersions(prev => ({ ...prev, [processor.id]: res.version! }))
        } else {
          toast.error(t("testFailed"))
        }
      },
      onError: () => {
        toast.error(t("testFailed"))
      },
      onSettled: () => {
        setTesting(null)
      }
    })
  }

  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setFormData({ ...initialDocProcessorConfig, id: crypto.randomUUID() })
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
      toast.error(t("requiredName"))
      return
    }
    if (!formData.base_url.trim()) {
      toast.error(t("requiredUrl"))
      return
    }

    let updated: DocProcessorConfig[]
    if (editingIndex !== null) {
      // 编辑模式
      updated = processors.map((p, i) => i === editingIndex ? formData : p)
    } else {
      // 新增模式
      if (processors.some(p => p.name === formData.name)) {
        toast.error(t("nameExists"))
        return
      }
      updated = [...processors, formData]
    }

    handleSave(updated)
    handleCancel()
  }

  const handleDelete = async (processorId: string) => {
    if (!await confirm({ description: t("deleteConfirm"), variant: "destructive" })) return
    const updated = processors.filter(p => p.id !== processorId)
    handleSave(updated)
  }

  const handleToggleEnabled = (processorId: string, enabled: boolean) => {
    const updated = processors.map(p =>
      p.id === processorId ? { ...p, enabled } : p
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
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("title")}</h2>
              <p className="text-sm text-slate-500 font-medium">{t("description")}</p>
            </div>
          </div>
          {!isAdding && editingIndex === null && (
            <Button
              onClick={handleStartAdd}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("addProcessor")}
            </Button>
          )}
        </div>



        {/* 添加表单 */}
        {isAdding && (
          <DocProcessorForm
            formData={formData}
            setFormData={setFormData}
            isEditing={editingIndex !== null}
            isSaving={updateMutation.isPending}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
          />
        )}

        {/* Processor List */}
        {processors.length === 0 && !isAdding ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">{t("noConfig")}</p>
              <Button
                variant="outline"
                onClick={handleStartAdd}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("addFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {processors.map((processor, index) => (
              editingIndex === index ? (
                <div key={processor.id}>
                  <DocProcessorForm
                    formData={formData}
                    setFormData={setFormData}
                    isEditing={editingIndex !== null}
                    isSaving={updateMutation.isPending}
                    onCancel={handleCancel}
                    onSubmit={handleSubmit}
                  />
                </div>
              ) : (
                <Card key={processor.id} className={`transition-all ${!processor.enabled ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const typeInfo = DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)
                          const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }

                          if (typeInfo?.icon.startsWith("/")) {
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
                            {versions[processor.id] && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                v{versions[processor.id]}
                              </span>
                            )}
                            {processor.origin === "platform" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                <Globe className="h-3 w-3 mr-1" />
                                {t("platformShared")}
                              </span>
                            )}
                          </div>
                          <CardDescription>
                            {DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)?.label || processor.type}
                          </CardDescription>
                          {(() => {
                            const formats = DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)?.formats
                            if (!formats?.length) return null
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {formats.map(f => (
                                  <span key={f} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {processor.origin !== "platform" && (
                          <Switch
                            checked={processor.enabled}
                            onCheckedChange={(checked: boolean) => handleToggleEnabled(processor.id, checked)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTest(processor)}
                          disabled={testing === processor.id || processor.origin === "platform"}
                          title={processor.origin === "platform" ? t("platformShared") : t("testConnect")}
                        >
                          {testing === processor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex items-center gap-2" title={processor.origin === "platform" ? t("platformResourceDesc") : undefined}>
                          {processor.origin !== "platform" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(index)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(processor.id)}
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
