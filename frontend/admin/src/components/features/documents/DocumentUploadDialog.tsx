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

interface ProcessorExtraConfig {
  is_ocr?: boolean
  extract_images?: boolean
  extract_tables?: boolean
}

type DocProcessor = Omit<DocProcessorConfig, "config"> & {
  config?: ProcessorExtraConfig
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

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
  const [files, setFiles] = useState<File[]>([])
  const [processor, setProcessor] = useState<string>("")
  const [processors, setProcessors] = useState<DocProcessor[]>([])
  const [isLoadingProcessors, setIsLoadingProcessors] = useState(false)
  const [collectionId, setCollectionId] = useState<string>("")
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [extractImages, setExtractImages] = useState(false)
  const [extractTables, setExtractTables] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string>("")

  // 获取解析器列表
  useEffect(() => {
    if (open) {
      const fetchProcessors = async () => {
        try {
          setIsLoadingProcessors(true)
          const res = await api.systemConfig.getDocProcessorConfig()
          const list = Array.isArray(res?.processors)
            ? res.processors
              .filter((item): item is Record<string, unknown> => isRecord(item))
              .map((item) => ({
                name: typeof item.name === "string" ? item.name : "",
                type: parseDocProcessorType(item.type),
                enabled: Boolean(item.enabled),
                config: parseProcessorConfig(item.config),
                origin: parseProcessorOrigin(item.origin),
                baseUrl: typeof item.baseUrl === "string" ? item.baseUrl : "",
                apiKey: typeof item.apiKey === "string" ? item.apiKey : "",
              }))
            : []
          const activeProcessors = list.filter(p => p.enabled)

          // 按指定顺序排序: MinerU -> Docling -> PaddleOCR
          const typeOrder = ['MinerU', 'Docling', 'PaddleOCR']
          activeProcessors.sort((a, b) => {
            const orderA = typeOrder.indexOf(a.type)
            const orderB = typeOrder.indexOf(b.type)
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
          })

          setProcessors(activeProcessors)

          // 默认选中第一个并同步设置
          if (activeProcessors.length > 0) {
            const first = activeProcessors[0]
            setProcessor(first.name)
            if (first.config) {
              setOcrEnabled(first.config.is_ocr ?? false)
              setExtractImages(first.config.extract_images ?? false)
              setExtractTables(first.config.extract_tables ?? false)
            }
          }
        } catch (error) {
          console.error("Failed to fetch processors:", error)
          toast.error("获取文档解析器配置失败")
        } finally {
          setIsLoadingProcessors(false)
        }
      }
      fetchProcessors()
    }
  }, [open])

  // 重置其他状态
  useEffect(() => {
    if (open) {
      setFiles([])
      setCollectionId("")
      setOcrEnabled(false)
      setExtractImages(false)
      setExtractTables(false)
      setIsUploading(false)
      setUploadProgress(0)
      setCurrentUploadingFile("")
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      // 简单验证文件类型
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
      const validFiles = selectedFiles.filter(f => {
        if (!allowedTypes.includes(f.type)) {
          toast.error(`文件 ${f.name} 类型不支持，已跳过`)
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
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
      const validFiles = selectedFiles.filter(f => {
        if (!allowedTypes.includes(f.type)) {
          toast.error(`文件 ${f.name} 类型不支持，已跳过`)
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

  const handleProcessorChange = (name: string) => {
    setProcessor(name)
    const selected = processors.find(p => p.name === name)
    if (selected && selected.config) {
      const cfg = parseProcessorConfig(selected.config)
      setOcrEnabled(cfg.is_ocr ?? false)
      setExtractImages(cfg.extract_images ?? false)
      setExtractTables(cfg.extract_tables ?? false)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("请选择至少一个文件")
      return
    }
    if (!collectionId) {
      toast.error("请选择所属合集")
      return
    }

    try {
      setIsUploading(true)
      let successCount = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentUploadingFile(`正在处理 (${i + 1}/${files.length}): ${file.name}`)
        setUploadProgress(0)

        // 模拟进度条
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) return prev
            return prev + 10
          })
        }, 300)

        try {
          const selectedProcessor = processors.find(p => p.name === processor)
          const type = selectedProcessor?.type || "MinerU"

          const formData = new FormData()
          formData.append("file", file)
          formData.append("site_id", siteId.toString())
          formData.append("collection_id", collectionId)
          formData.append("processor_type", type)
          formData.append("ocr_enabled", ocrEnabled.toString())
          formData.append("extract_images", extractImages.toString())
          formData.append("extract_tables", extractTables.toString())

          await api.document.importDocument(formData)
          successCount++
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "未知错误"
          toast.error(`文件 ${file.name} 上传失败: ${errMsg}`)
        } finally {
          clearInterval(interval)
          setUploadProgress(100)
        }
      }

      if (successCount > 0) {
        toast.success(`成功导入 ${successCount} 个文档`)
        if (successCount === files.length) {
          // 全部成功，关闭弹窗
          onOpenChange(false)
        } else {
          // 部分成功，移除成功的（这里简化为不移除，让用户看到哪些还在）
          // 或者直接重置
          onOpenChange(false) // 还是关闭吧，刷新列表看到结果
        }

        // 触发父组件刷新
        if (onSuccess) {
          onSuccess();
        }

      }

    } catch (error: unknown) {
      toast.error("批量上传过程出错")
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
            批量导入文档
          </DialogTitle>
          <DialogDescription>
            支持上传多个 PDF 或图片，使用 AI 解析器提取内容。
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
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                <Upload className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-600">点击上传或拖拽文件到此处</p>
              <p className="text-sm text-slate-400 mt-1">支持多选 PDF, JPG, PNG 格式</p>
            </div>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 bg-white rounded flex items-center justify-center shrink-0 border border-slate-100">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">{file.name}</p>
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
              <Label>解析器</Label>
              <Select value={processor} onValueChange={handleProcessorChange} disabled={processors.length === 0 || isLoadingProcessors}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingProcessors ? "加载中..." : (processors.length === 0 ? "无可用解析器" : "选择解析器")} />
                </SelectTrigger>
                <SelectContent>
                  {processors.map(p => {
                    const typeInfo = DOC_PROCESSOR_TYPES.find(t => t.value === p.type)
                    const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
                    const Icon = typeInfo ? icons[typeInfo.icon] || FileText : FileText
                    return (
                      <SelectItem key={p.name} value={p.name} disabled={typeInfo?.disabled}>
                        <div className="flex items-center gap-2">
                          {typeInfo?.icon.startsWith('/') ? (
                            <Image src={typeInfo.icon} alt="" width={16} height={16} className="object-contain" />
                          ) : (
                            <Icon className={`h-4 w-4 ${typeInfo?.color.split(' ')[0] || "text-slate-500"}`} />
                          )}
                          <span>{p.name}</span>
                          <span className="text-xs text-slate-400">({p.type})</span>
                          {p.origin === 'platform' && (
                            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                              <Globe className="h-2.5 w-2.5 mr-1" />
                              平台
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {processors.length === 0 && !isLoadingProcessors && (
                <p className="text-xs text-red-500">需要在系统设置中配置并开启至少一个文档解析器。</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>所属合集 <span className="text-red-500">*</span></Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择合集..." />
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
            processor && ['MinerU', 'Docling', 'PaddleOCR'].includes(processors.find(p => p.name === processor)?.type || '') && (
              <div className="space-y-3">
                {/* OCR */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">OCR识别</Label>
                    <p className="text-xs text-slate-500">
                      {processors.find(p => p.name === processor)?.type === 'Docling'
                        ? "启用 Docling OCR 识别，更好地处理扫描件。"
                        : "对扫描件或复杂公式启用 OCR 识别，速度较慢但精度更高。"
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
                    <Label className="text-sm font-medium">提取图片</Label>
                    <p className="text-xs text-slate-500">
                      提取文档中的图片作为单独的资源。
                    </p>
                  </div>
                  <Switch
                    checked={extractImages}
                    onCheckedChange={setExtractImages}
                  />
                </div>

                {/* Extract Tables (Docling Only) */}
                {processors.find(p => p.name === processor)?.type === 'Docling' && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">表格结构识别</Label>
                      <p className="text-xs text-slate-500">
                        识别文档中的表格结构，生成结构化数据。
                      </p>
                    </div>
                    <Switch
                      checked={extractTables}
                      onCheckedChange={setExtractTables}
                    />
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
            取消
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || !collectionId || !processor || isUploading}>
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUploading ? "处理中..." : `开始批量导入 (${files.length})`}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}
