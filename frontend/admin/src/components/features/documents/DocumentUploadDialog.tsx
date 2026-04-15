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

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  type LucideIcon,
  Loader2,
  Upload,
  FileText,
  X,
  Bird,
  Zap,
  Scan,
  BookOpen,
  Pickaxe,
  Globe
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { DOC_PROCESSOR_TYPES, type DocProcessorConfig, DocProcessorType } from "@/types/settings"
import { CollectionItem } from "@/types"
import { useTasks } from "@/contexts/TaskContext"

interface ProcessorExtraConfig {
  is_ocr?: boolean
  extract_images?: boolean
  extract_tables?: boolean
}

type DocProcessor = Omit<DocProcessorConfig, "config"> & {
  config?: ProcessorExtraConfig
}

import { isRecord } from "@/lib/utils"

function parseProcessorConfig(config: unknown): ProcessorExtraConfig {
  if (!isRecord(config)) {
    return {}
  }
  return {
    is_ocr: typeof config.is_ocr === "boolean" ? config.is_ocr : undefined,
    extract_images: typeof config.extract_images === "boolean" ? config.extract_images : undefined,
    extract_tables: typeof config.extract_tables === "boolean" ? config.extract_tables : undefined,
  }
}

function parseDocProcessorType(value: unknown): DocProcessorType {
  if (value === DocProcessorType.DOCLING || value === DocProcessorType.MINER_U || value === DocProcessorType.PADDLE_OCR) {
    return value
  }
  return DocProcessorType.MINER_U
}

function parseProcessorOrigin(value: unknown): "platform" | "tenant" | undefined {
  if (value === "platform" || value === "tenant") {
    return value
  }
  return undefined
}

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: number
  collections: CollectionItem[]
  onSuccess?: () => void
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  siteId,
  collections,
  onSuccess
}: DocumentUploadDialogProps) {
  const t = useTranslations('DocUpload')
  const [files, setFiles] = useState<File[]>([])
  const [processorId, setProcessorId] = useState<string>("")
  const [processors, setProcessors] = useState<DocProcessor[]>([])
  const [isLoadingProcessors, setIsLoadingProcessors] = useState(false)
  const [collectionId, setCollectionId] = useState<string>("")
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [extractImages, setExtractImages] = useState(false)
  const [extractTables, setExtractTables] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string>("")
  const { addTasks } = useTasks()

  // 获取解析器列表
  useEffect(() => {
    if (open) {
      const fetchProcessors = async () => {
        try {
          setIsLoadingProcessors(true)
          const res = await api.systemConfig.getDocProcessorConfig()
          const list = Array.isArray(res?.processors)
            ? (res.processors as any[])
              .filter((item): item is Record<string, unknown> => isRecord(item))
              .map((item: Record<string, unknown>) => ({
                id: typeof item.id === "string" ? item.id : "",
                name: typeof item.name === "string" ? item.name : "",
                type: parseDocProcessorType(item.type),
                enabled: Boolean(item.enabled),
                config: parseProcessorConfig(item.config),
                origin: parseProcessorOrigin(item.origin),
                base_url: typeof item.base_url === "string" ? item.base_url : "",
                api_key: typeof item.api_key === "string" ? item.api_key : "",
              }))
            : []
          const activeProcessors = list.filter((p: DocProcessor) => p.enabled)

          // 按指定顺序排序: MinerU -> Docling -> PaddleOCR
          const typeOrder = ['MinerU', 'Docling', 'PaddleOCR']
          activeProcessors.sort((a: DocProcessor, b: DocProcessor) => {
            const orderA = typeOrder.indexOf(a.type)
            const orderB = typeOrder.indexOf(b.type)
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
          })

          setProcessors(activeProcessors)

          // 默认选中第一个并同步设置，优先恢复上次选择
          if (activeProcessors.length > 0) {
            const cachedId = localStorage.getItem("doc_upload_processor_id")
            const target = (cachedId && activeProcessors.find((p: DocProcessor) => p.id === cachedId))
              || activeProcessors[0]
            setProcessorId(target.id)
            if (target.config) {
              setOcrEnabled(target.config.is_ocr ?? false)
              setExtractImages(target.config.extract_images ?? false)
              setExtractTables(target.config.extract_tables ?? true)
            }
          }
        } catch (error) {
          console.error("Failed to fetch processors:", error)
          toast.error(t("fetchProcessorFailed"))
        } finally {
          setIsLoadingProcessors(false)
        }
      }
      fetchProcessors()
    }
  }, [open, t])

  // 重置其他状态
  useEffect(() => {
    if (open) {
      setFiles([])
      setCollectionId("")
      setOcrEnabled(false)
      setExtractImages(false)
      setExtractTables(true)
      setIsUploading(false)
      setUploadProgress(0)
      setCurrentUploadingFile("")
    }
  }, [open])

  const FORMAT_TO_EXT: Record<string, string> = {
    PDF: ".pdf",
    Word: ".docx,.doc",
    PPT: ".pptx,.ppt",
    Excel: ".xlsx,.xls",
    HTML: ".html,.htm",
    Image: ".jpg,.jpeg,.png,.webp,.tiff",
    Markdown: ".md",
  }
  const FORMAT_TO_MIME: Record<string, string[]> = {
    PDF: ["application/pdf"],
    Word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
    PPT: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"],
    Excel: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
    HTML: ["text/html"],
    Image: ["image/jpeg", "image/png", "image/webp", "image/tiff"],
    Markdown: ["text/markdown", "text/plain"],
  }
  const selectedProcessor = processors.find(p => p.id === processorId)
  const selectedTypeInfo = selectedProcessor
    ? DOC_PROCESSOR_TYPES.find(t => t.value === selectedProcessor.type)
    : null
  const acceptTypes = selectedTypeInfo?.formats
    ? selectedTypeInfo.formats.map(f => FORMAT_TO_EXT[f] || "").filter(Boolean).join(",")
    : ".pdf"
  const allowedMimeTypes = selectedTypeInfo?.formats
    ? selectedTypeInfo.formats.flatMap(f => FORMAT_TO_MIME[f] || [])
    : ["application/pdf"]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles = selectedFiles.filter(f => {
        if (!allowedMimeTypes.includes(f.type)) {
          toast.error(t("unsupportedFile", { name: f.name }))
          return false
        }
        return true
      })
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFiles = Array.from(e.dataTransfer.files)
      const validFiles = selectedFiles.filter(f => {
        if (!allowedMimeTypes.includes(f.type)) {
          toast.error(t("unsupportedFile", { name: f.name }))
          return false
        }
        return true
      })
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcessorChange = (id: string) => {
    setProcessorId(id)
    const selected = processors.find(p => p.id === id)
    if (selected && selected.config) {
      const cfg = parseProcessorConfig(selected.config)
      setOcrEnabled(cfg.is_ocr ?? false)
      setExtractImages(cfg.extract_images ?? false)
      setExtractTables(cfg.extract_tables ?? true)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error(t("selectFile"))
      return
    }
    if (!collectionId) {
      toast.error(t("selectCollection"))
      return
    }

    try {
      setIsUploading(true)
      localStorage.setItem("doc_upload_processor_id", processorId)
      let successCount = 0
      const generatedTasks = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentUploadingFile(t("uploading", { current: i + 1, total: files.length, name: file.name }))
        setUploadProgress(0)

        // 模拟上传进度条
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) return prev
            return prev + 10
          })
        }, 300)

        try {
          const currentProcessor = processors.find(p => p.id === processorId)
          const type = currentProcessor?.type || "MinerU"

          const formData = new FormData()
          formData.append("file", file)
          formData.append("site_id", siteId.toString())
          formData.append("collection_id", collectionId)
          formData.append("processor_type", type)
          formData.append("ocr_enabled", ocrEnabled.toString())
          formData.append("extract_images", extractImages.toString())
          formData.append("extract_tables", extractTables.toString())

          const task = await api.document.importDocument(formData)
          generatedTasks.push(task as any)
          successCount++
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error"
          toast.error(t("uploadFailed", { name: file.name, error: errMsg }))
        } finally {
          clearInterval(interval)
          setUploadProgress(100)
        }
      }

      if (successCount > 0) {
        toast.success(t("uploadSuccess", { count: successCount }))
        addTasks(generatedTasks)
        onOpenChange(false)
      }

    } catch (error: unknown) {
      toast.error(t("batchError"))
    } finally {
      setIsUploading(false)
      setCurrentUploadingFile("")
    }
  }

  // 扁平化合集列表用于 Select
  const flattenCollections = (items: CollectionItem[], level = 0): { id: string, name: string, level: number }[] => {
    const result: { id: string, name: string, level: number }[] = []
    items.forEach(item => {
      // 只显示合集类型
      if (item.type === 'collection') {
        result.push({ id: item.id, name: item.name, level })
        if (item.children && item.children.length > 0) {
          result.push(...flattenCollections(item.children, level + 1))
        }
      }
    })
    return result
  }

  const flattenedCollections = flattenCollections(collections)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* 文件上传区 */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${files.length > 0 ? 'border-primary/50 bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
              }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept={acceptTypes}
              multiple
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                <Upload className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-600">{t("dropzone")}</p>
              <p className="text-sm text-slate-400 mt-1">
                {selectedTypeInfo?.formats
                  ? selectedTypeInfo.formats.join(", ")
                  : "PDF"}
              </p>
            </div>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, index) => (
                <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-8 w-8 bg-white rounded flex items-center justify-center shrink-0 border border-slate-100">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-900 break-all">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-red-500 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 配置项 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("parser")}</Label>
              <Select value={processorId} onValueChange={handleProcessorChange} disabled={processors.length === 0 || isLoadingProcessors}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingProcessors ? t("loading") : (processors.length === 0 ? t("noParser") : t("selectParser"))} />
                </SelectTrigger>
                <SelectContent>
                  {processors.map(p => {
                    const typeInfo = DOC_PROCESSOR_TYPES.find(t => t.value === p.type)
                    const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
                    const Icon = typeInfo ? icons[typeInfo.icon] || FileText : FileText
                    return (
                      <SelectItem key={p.id} value={p.id} disabled={typeInfo?.disabled}>
                        <div className="flex items-center gap-2 w-full min-w-0">
                          {typeInfo?.icon.startsWith('/') ? (
                            <Image src={typeInfo.icon} alt="" width={16} height={16} className="object-contain shrink-0" />
                          ) : (
                            <Icon className={`h-4 w-4 shrink-0 ${typeInfo?.color.split(' ')[0] || "text-slate-500"}`} />
                          )}
                          <span className="truncate font-medium flex-1">{p.name}</span>
                          <span className="text-xs text-slate-400 shrink-0 opacity-70">({p.type})</span>
                          {p.origin === 'platform' && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 ml-1">
                              <Globe className="h-2.5 w-2.5 mr-0.5" />
                              {t("platform")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {processors.length === 0 && !isLoadingProcessors && (
                <p className="text-xs text-red-500">{t("parserHint")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("collection")} <span className="text-red-500">*</span></Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("collectionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {flattenedCollections.map(col => (
                    <SelectItem key={col.id} value={col.id}>
                      <span style={{ paddingLeft: `${col.level * 10}px` }}>{col.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {
            processorId && ['MinerU', 'Docling', 'PaddleOCR'].includes(processors.find(p => p.id === processorId)?.type || '') && (
              <div className="space-y-3">
                {/* OCR */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t("ocr")}</Label>
                    <p className="text-xs text-slate-500">
                      {processors.find(p => p.id === processorId)?.type === 'Docling'
                        ? t("ocrDescDocling")
                        : t("ocrDescDefault")
                      }
                    </p>
                  </div>
                  <Switch
                    checked={ocrEnabled}
                    onCheckedChange={setOcrEnabled}
                  />
                </div>

                {/* Extract Images */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t("extractImages")}</Label>
                    <p className="text-xs text-slate-500">
                      {t("extractImagesDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={extractImages}
                    onCheckedChange={setExtractImages}
                  />
                </div>

                {/* Extract Tables (Docling & MinerU & PaddleOCR) */}
                {['Docling', 'MinerU', 'PaddleOCR'].includes(processors.find(p => p.id === processorId)?.type || '') && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">{t("extractTables")}</Label>
                      <p className="text-xs text-slate-500">{t("extractTablesDesc")}</p>
                    </div>
                    <Switch checked={extractTables} onCheckedChange={setExtractTables} />
                  </div>
                )}
              </div>
            )
          }

          {
            isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{currentUploadingFile}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )
          }
        </div >

        <DialogFooter className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            {t("cancel")}
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || !collectionId || !processorId || isUploading}>
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUploading ? t("processing") : t("submit", { count: files.length })}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}
