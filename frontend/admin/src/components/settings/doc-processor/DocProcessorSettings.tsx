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
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  type DocProcessorConfig,
  type DocProcessorType,
  DOC_PROCESSOR_TYPES,
  initialDocProcessorConfig
} from "@/types/settings"
import { useDocProcessorConfig, useUpdateDocProcessorConfig, useTestDocProcessorConnection } from "@/hooks"

const getConfigFlag = (config: DocProcessorConfig["config"], key: string, fallback = false): boolean => {
  const value = config?.[key]
  return typeof value === "boolean" ? value : fallback
}

export function DocProcessorSettings({ scope = 'tenant' }: { scope?: 'platform' | 'tenant' }) {
  const t = useTranslations("DocProcessor")
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

  // 使用 ref 稳定 testMutation 引用，避免 useEffect 无限循环
  const testMutationRef = useRef(testMutation)
  testMutationRef.current = testMutation

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
    const tenantProcessors = updatedProcessors.filter(p => p.origin !== 'platform')
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

  const handleDelete = (processorId: string) => {
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

  // 内联编辑表单
  const renderForm = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {editingIndex !== null ? t("editProcessor") : t("addProcessor")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled" className="text-sm font-medium cursor-pointer">{t("enabled")}</Label>
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
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={editingIndex !== null}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t("type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: DocProcessorType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_PROCESSOR_TYPES.map((type) => {
                    const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
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
                      {selectedType.docUrl && (
                        <a
                          href={selectedType.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {t("deployDoc")} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  )
                }
                return null
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_url">{t("baseUrl")}</Label>
            <Input
              id="base_url"
              placeholder={t("baseUrlPlaceholder")}
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            />
            {(() => {
              const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
              if (selectedType) {
                return (
                  <p className="text-xs text-slate-500">
                    {t("endpoint")}: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{selectedType.endpoint}</code>
                  </p>
                )
              }
            })()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">
              {formData.type === 'Docling' ? 'API Key (X-Api-Key)' : t("apiKey")}
              <span className="text-slate-400 font-normal ml-1">{t("optional")}</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              placeholder={formData.type === 'Docling' ? t("enterApiKey") : t("apiKeyPlaceholder")}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              autoComplete="new-password"
              name="doc_processor_api_key_disable_autofill"
            />
          </div>

          {/* 特定配置区域 */}
          {(formData.type === "Docling" || formData.type === "MinerU" || formData.type === "PaddleOCR") && (
            <div className="bg-white/50 rounded-lg p-4 border border-primary/10 space-y-3">
              <Label className="text-xs font-medium text-primary/80 uppercase tracking-wider">{t("capabilities")}</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_ocr"
                    checked={getConfigFlag(formData.config, "is_ocr")}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, is_ocr: checked }
                      })
                    }
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="is_ocr" className="text-sm">{t("ocr")}</Label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="extract_images"
                    checked={getConfigFlag(formData.config, "extract_images")}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, extract_images: checked }
                      })
                    }
                  />
                  <Label htmlFor="extract_images" className="text-sm">{t("extractImages")}</Label>
                </div>

                {formData.type === "Docling" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="extract_tables"
                        checked={getConfigFlag(formData.config, "extract_tables")}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, extract_tables: checked }
                          })
                        }
                      />
                      <Label htmlFor="extract_tables" className="text-sm">{t("extractTables")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="do_formula_enrichment"
                        checked={(formData.config as any)?.do_formula_enrichment !== false}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, do_formula_enrichment: checked }
                          })
                        }
                      />
                      <Label htmlFor="do_formula_enrichment" className="text-sm">{t("formulaRecognition")}</Label>
                    </div>
                  </>
                )}

                {formData.type === "MinerU" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="formula_enable"
                        checked={(formData.config as any)?.formula_enable !== false}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({ ...formData, config: { ...formData.config, formula_enable: checked } })
                        }
                      />
                      <Label htmlFor="formula_enable" className="text-sm">{t("formulaRecognition")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="table_enable"
                        checked={(formData.config as any)?.table_enable !== false}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({ ...formData, config: { ...formData.config, table_enable: checked } })
                        }
                      />
                      <Label htmlFor="table_enable" className="text-sm">{t("extractTables")}</Label>
                    </div>
                  </>
                )}
              </div>

              {/* Docling 专属配置 */}
              {formData.type === "Docling" && (
                <div className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_ocr_engine" className="text-sm">{t("ocrEngine")}</Label>
                      <Select
                        value={(formData.config as any)?.ocr_engine || "rapidocr"}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, ocr_engine: value } })
                        }
                      >
                        <SelectTrigger id="docling_ocr_engine"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rapidocr">rapidocr</SelectItem>
                          <SelectItem value="easyocr">easyocr</SelectItem>
                          <SelectItem value="tesseract">tesseract</SelectItem>
                          <SelectItem value="tesserocr">tesserocr</SelectItem>
                          <SelectItem value="ocrmac">ocrmac</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_pdf_backend" className="text-sm">{t("pdfBackend")}</Label>
                      <Select
                        value={(formData.config as any)?.pdf_backend || "dlparse_v4"}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, pdf_backend: value } })
                        }
                      >
                        <SelectTrigger id="docling_pdf_backend"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dlparse_v4">dlparse_v4（推荐）</SelectItem>
                          <SelectItem value="dlparse_v2">dlparse_v2</SelectItem>
                          <SelectItem value="dlparse_v1">dlparse_v1</SelectItem>
                          <SelectItem value="pypdfium2">pypdfium2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_pipeline" className="text-sm">{t("doclingPipeline")}</Label>
                      <Select
                        value={(formData.config as any)?.pipeline || "standard"}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, pipeline: value } })
                        }
                      >
                        <SelectTrigger id="docling_pipeline"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">standard（推荐）</SelectItem>
                          <SelectItem value="vlm">vlm（需要 GPU）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* MinerU 专属配置 */}
              {formData.type === "MinerU" && (
                <div className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="space-y-1.5">
                    <Label htmlFor="mineru_backend" className="text-sm">{t("mineruBackend")}</Label>
                    <Select
                      value={(formData.config as any)?.backend || "hybrid-auto-engine"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, config: { ...formData.config, backend: value } })
                      }
                    >
                      <SelectTrigger id="mineru_backend">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hybrid-auto-engine">{t("hybridAutoEngine")}</SelectItem>
                        <SelectItem value="pipeline">{t("pipeline")}</SelectItem>
                        <SelectItem value="vlm-auto-engine">{t("vlmAutoEngine")}</SelectItem>
                        <SelectItem value="vlm-http-client">{t("vlmHttpClient")}</SelectItem>
                        <SelectItem value="hybrid-http-client">{t("hybridHttpClient")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mineru_parse_method" className="text-sm">{t("parseMethod")}</Label>
                    <Select
                      value={(formData.config as any)?.parse_method || "auto"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, config: { ...formData.config, parse_method: value } })
                      }
                    >
                      <SelectTrigger id="mineru_parse_method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("parseAuto")}</SelectItem>
                        <SelectItem value="ocr">{t("parseOcr")}</SelectItem>
                        <SelectItem value="txt">{t("parseTxt")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("recognitionLanguage")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "ch", label: t("langCh") },
                        { value: "en", label: t("langEn") },
                        { value: "korean", label: t("langKorean") },
                        { value: "japan", label: t("langJapan") },
                        { value: "chinese_cht", label: t("langCht") },
                        { value: "latin", label: t("langLatin") },
                        { value: "arabic", label: t("langArabic") },
                        { value: "cyrillic", label: t("langCyrillic") },
                        { value: "east_slavic", label: t("langEastSlavic") },
                        { value: "devanagari", label: t("langDevanagari") },
                        { value: "th", label: t("langTh") },
                        { value: "el", label: t("langEl") },
                        { value: "ta", label: t("langTa") },
                        { value: "te", label: t("langTe") },
                        { value: "ka", label: t("langKa") },
                      ].map(({ value: lang, label }) => {
                        const current: string[] = (formData.config as any)?.lang_list || ["ch", "en"]
                        const selected = current.includes(lang)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? current.filter((l: string) => l !== lang)
                                : [...current, lang]
                              if (next.length === 0) return
                              setFormData({ ...formData, config: { ...formData.config, lang_list: next } })
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              selected
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {t("save")}
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
        {isAdding && renderForm()}

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
                <div key={processor.id}>{renderForm()}</div>
              ) : (
                <Card key={processor.id} className={`transition-all ${!processor.enabled ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const typeInfo = DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)
                          const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }

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
                            {versions[processor.id] && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                v{versions[processor.id]}
                              </span>
                            )}
                            {processor.origin === 'platform' && (
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
                        {processor.origin !== 'platform' && (
                          <Switch
                            checked={processor.enabled}
                            onCheckedChange={(checked: boolean) => handleToggleEnabled(processor.id, checked)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTest(processor)}
                          disabled={testing === processor.id || processor.origin === 'platform'}
                          title={processor.origin === 'platform' ? t("platformShared") : t("testConnect")}
                        >
                          {testing === processor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex items-center gap-2" title={processor.origin === 'platform' ? t("platformResourceDesc") : undefined}>
                          {processor.origin !== 'platform' && (
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
