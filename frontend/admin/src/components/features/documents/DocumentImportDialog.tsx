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

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Button, Label, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import {
  type LucideIcon,
  Loader2, Upload, FileText, X, Bird, Zap, Scan, BookOpen, Pickaxe, Globe,
  Database, Folder, ChevronRight, ArrowLeft, CheckSquare, Square, Plus,
} from "lucide-react"
import { toast } from "sonner"
import { browseDataSource, importFromDataSource, listDataSources } from "@/lib/sdk/admin-data-sources"
import { importDocument } from "@/lib/sdk/admin-documents"
import { getAdminDocProcessorConfig } from "@/lib/sdk/admin-system-configs"
import type { S3FileItem, Task } from "@/lib/sdk/sdk.schemas"
import { toImportDocumentBody } from "@/lib/normalizers"
import { DOC_PROCESSOR_TYPES, type DocProcessorConfig, DocProcessorType } from "@/types/settings"
import type { CollectionItem } from "@/types"
import { useTasks } from "@/contexts/TaskContext"
import { isRecord } from "@/lib/utils"

interface ProcessorExtraConfig {
  is_ocr?: boolean
  extract_images?: boolean
  extract_tables?: boolean
}

type DocProcessor = Omit<DocProcessorConfig, "config"> & { config?: ProcessorExtraConfig }

function parseProcessorConfig(config: unknown): ProcessorExtraConfig {
  if (!isRecord(config)) return {}
  return {
    is_ocr: typeof config.is_ocr === "boolean" ? config.is_ocr : undefined,
    extract_images: typeof config.extract_images === "boolean" ? config.extract_images : undefined,
    extract_tables: typeof config.extract_tables === "boolean" ? config.extract_tables : undefined,
  }
}

function parseDocProcessorType(value: unknown): DocProcessorType {
  if (value === "Docling" as const || value === "MinerU" as const || value === "PaddleOCR" as const) return value
  return "MinerU" as const
}

function parseProcessorOrigin(value: unknown): "platform" | "tenant" | undefined {
  if (value === "platform" || value === "tenant") return value
  return undefined
}

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

function flattenCollections(items: CollectionItem[], level = 0): { id: string; name: string; level: number }[] {
  const result: { id: string; name: string; level: number }[] = []
  items.forEach(item => {
    if (item.type === "collection") {
      result.push({ id: item.id, name: item.name, level })
      if (item.children?.length) result.push(...flattenCollections(item.children, level + 1))
    }
  })
  return result
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type SourceTab = "upload" | "datasource"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: number
  collections: CollectionItem[]
  defaultTab?: SourceTab
  onSuccess?: () => void
}

export function DocumentImportDialog({
  open, onOpenChange, siteId, collections, defaultTab = "upload", onSuccess,
}: Props) {
  const t = useTranslations("DocImport")
  const { addTasks } = useTasks()
  const router = useRouter()
  const searchParams = useSearchParams()
  const flattenedCollections = flattenCollections(collections)

  const goAddDataSource = () => {
    onOpenChange(false)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("modal", "settings")
    params.set("tab", "data-sources")
    router.push(`?${params.toString()}`)
  }

  // ---------- Tab ----------
  const [activeTab, setActiveTab] = useState<SourceTab>(defaultTab)

  // ---------- 上传 Tab ----------
  const [files, setFiles] = useState<File[]>([])

  // ---------- 数据源 Tab ----------
  const [selectedDsId, setSelectedDsId] = useState<number | null>(null)
  const [browsePrefix, setBrowsePrefix] = useState("")
  const [browseStack, setBrowseStack] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // ---------- 通用配置 ----------
  const [processorId, setProcessorId] = useState<string>("")
  const [collectionId, setCollectionId] = useState<string>("")
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [extractImages, setExtractImages] = useState(false)
  const [extractTables, setExtractTables] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [generateSummary, setGenerateSummary] = useState(false)
  const [generateTags, setGenerateTags] = useState(false)
  const [autoVectorize, setAutoVectorize] = useState(false)

  // ---------- 上传进度（importDocument 是 loop，react-query 不直接覆盖）----------
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentUploadingFile, setCurrentUploadingFile] = useState("")

  // 打开时重置
  useEffect(() => {
    if (!open) return
    setActiveTab(defaultTab)
    setFiles([])
    setSelectedKeys(new Set())
    setBrowsePrefix("")
    setBrowseStack([])
    setCollectionId("")
    setSkipDuplicates(false)
    setGenerateSummary(false)
    setGenerateTags(false)
    setAutoVectorize(false)
    setOcrEnabled(false)
    setExtractImages(false)
    setExtractTables(true)
    setUploadProgress(0)
    setCurrentUploadingFile("")
  }, [open, defaultTab])

  // ---------- 解析器列表 ----------
  const { data: processors = [], isLoading: isLoadingProcessors } = useQuery({
    queryKey: ["doc-processor-config", "import-dialog"],
    queryFn: async () => {
      try {
        const res = await getAdminDocProcessorConfig()
        const list = Array.isArray(res?.processors)
          ? (res.processors as unknown[])
              .filter((item): item is Record<string, unknown> => isRecord(item))
              .map(item => ({
                id: typeof item.id === "string" ? item.id : "",
                name: typeof item.name === "string" ? item.name : "",
                type: parseDocProcessorType(item.type),
                enabled: Boolean(item.enabled),
                config: parseProcessorConfig(item.config),
                origin: parseProcessorOrigin(item.origin),
                base_url: typeof item.base_url === "string" ? item.base_url : "",
                api_key: typeof item.api_key === "string" ? item.api_key : "",
              } as DocProcessor))
          : []
        const active = list.filter(p => p.enabled)
        const typeOrder = ["MinerU", "Docling", "PaddleOCR"]
        active.sort((a, b) => {
          const oa = typeOrder.indexOf(a.type), ob = typeOrder.indexOf(b.type)
          return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob)
        })
        return active
      } catch {
        toast.error(t("fetchProcessorFailed"))
        return []
      }
    },
    enabled: open,
  })

  // 解析器加载完成后，应用 localStorage 缓存的选中项与默认配置（只跑一次）
  useEffect(() => {
    if (!open || processors.length === 0 || processorId) return
    const cachedId = typeof window !== "undefined" ? localStorage.getItem("doc_import_processor_id") : null
    const target = (cachedId && processors.find(p => p.id === cachedId)) || processors[0]
    setProcessorId(target.id)
    if (target.config) {
      setOcrEnabled(target.config.is_ocr ?? false)
      setExtractImages(target.config.extract_images ?? false)
      setExtractTables(target.config.extract_tables ?? true)
    }
  }, [open, processors, processorId])

  // ---------- 数据源列表 ----------
  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      try {
        return (await listDataSources()) ?? []
      } catch {
        toast.error(t("loadSourcesFailed"))
        return []
      }
    },
    enabled: open && activeTab === "datasource",
  })

  // 数据源列表加载完成后，默认选中第一个
  useEffect(() => {
    if (dataSources.length > 0 && selectedDsId === null) setSelectedDsId(dataSources[0].id)
  }, [dataSources, selectedDsId])

  // ---------- 浏览文件 ----------
  const { data: browseFiles = [], isFetching: isBrowsing } = useQuery({
    queryKey: ["data-source-browse-import", selectedDsId, browsePrefix],
    queryFn: async () => {
      if (selectedDsId === null) return [] as S3FileItem[]
      try {
        return (await browseDataSource(selectedDsId, { prefix: browsePrefix })) ?? []
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : t("browseFailed"))
        return [] as S3FileItem[]
      }
    },
    enabled: open && activeTab === "datasource" && selectedDsId !== null,
  })

  // 浏览结果切换时清掉选中（不同目录的 key 集合不该混在一起）
  useEffect(() => { setSelectedKeys(new Set()) }, [selectedDsId, browsePrefix])

  // 数据源切换时回到根目录
  useEffect(() => {
    if (selectedDsId !== null) {
      setBrowseStack([])
      setBrowsePrefix("")
    }
  }, [selectedDsId])

  // ---------- 单文件上传 mutation（在 loop 里用 mutateAsync）----------
  const importDocumentMutation = useMutation({
    mutationFn: (fd: FormData) => importDocument(toImportDocumentBody(fd)),
  })

  // ---------- 数据源批量导入 mutation ----------
  const importFromSourceMutation = useMutation({
    mutationFn: (vars: { id: number; payload: Parameters<typeof importFromDataSource>[1] }) =>
      importFromDataSource(vars.id, vars.payload),
  })

  const isSubmitting = importDocumentMutation.isPending || importFromSourceMutation.isPending

  // ---------- 解析器派生 ----------
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
  const hasProcessorOptions = !!selectedProcessor && ["MinerU", "Docling", "PaddleOCR"].includes(selectedProcessor.type)

  const handleProcessorChange = (id: string) => {
    setProcessorId(id)
    const selected = processors.find(p => p.id === id)
    if (selected?.config) {
      const cfg = parseProcessorConfig(selected.config)
      setOcrEnabled(cfg.is_ocr ?? false)
      setExtractImages(cfg.extract_images ?? false)
      setExtractTables(cfg.extract_tables ?? true)
    }
  }

  // ---------- 上传 Tab 交互 ----------
  const acceptFiles = (input: FileList | null) => {
    if (!input) return
    const arr = Array.from(input).filter(f => {
      if (!allowedMimeTypes.includes(f.type)) {
        toast.error(t("unsupportedFile", { name: f.name }))
        return false
      }
      return true
    })
    setFiles(prev => [...prev, ...arr])
  }

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))

  // ---------- 数据源 Tab 交互 ----------
  const handleEnterDir = (item: S3FileItem) => {
    if (selectedDsId === null) return
    setBrowseStack(prev => [...prev, browsePrefix])
    setBrowsePrefix(item.path)
  }

  const handleBrowseBack = () => {
    if (selectedDsId === null || browseStack.length === 0) return
    const prev = browseStack[browseStack.length - 1]
    setBrowseStack(s => s.slice(0, -1))
    setBrowsePrefix(prev)
  }

  const toggleFileKey = (path: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allFiles = browseFiles.filter(f => f.type === "file")
    if (selectedKeys.size === allFiles.length) setSelectedKeys(new Set())
    else setSelectedKeys(new Set(allFiles.map(f => f.path)))
  }

  // ---------- 提交 ----------
  const submitUpload = async () => {
    if (files.length === 0) { toast.error(t("selectFile")); return }
    localStorage.setItem("doc_import_processor_id", processorId)
    const generated: Task[] = []
    const skipped: string[] = []
    const type = selectedProcessor?.type || "MinerU"

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentUploadingFile(t("uploading", { current: i + 1, total: files.length, name: file.name }))
        setUploadProgress(0)
        const interval = setInterval(() => setUploadProgress(prev => prev >= 90 ? prev : prev + 10), 300)
        try {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("site_id", String(siteId))
          fd.append("collection_id", collectionId)
          fd.append("processor_type", type)
          fd.append("ocr_enabled", String(ocrEnabled))
          fd.append("extract_images", String(extractImages))
          fd.append("extract_tables", String(extractTables))
          fd.append("duplicate_strategy", skipDuplicates ? "skip" : "allow")
          fd.append("generate_summary", String(generateSummary))
          fd.append("generate_tags", String(generateTags))
          fd.append("auto_vectorize", String(autoVectorize))
          const task = await importDocumentMutation.mutateAsync(fd)
          if (task) generated.push(task)
          else skipped.push(file.name)
        } catch (err: unknown) {
          toast.error(t("uploadFailed", { name: file.name, error: err instanceof Error ? err.message : "Unknown" }))
        } finally {
          clearInterval(interval)
          setUploadProgress(100)
        }
      }

      if (generated.length > 0) {
        toast.success(t("uploadSuccess", { count: generated.length }))
        addTasks(generated)
      }
      if (skipped.length > 0) {
        const preview = skipped.slice(0, 3).join("、")
        const suffix = skipped.length > 3 ? t("uploadSkippedMore", { count: skipped.length - 3 }) : ""
        toast.info(t("uploadSkipped", { names: preview + suffix }))
      }
      if (generated.length > 0 || skipped.length > 0) {
        onOpenChange(false)
        onSuccess?.()
      }
    } finally {
      setCurrentUploadingFile("")
    }
  }

  const submitDataSourceImport = async () => {
    if (selectedDsId === null) { toast.error(t("selectSource")); return }
    if (selectedKeys.size === 0) { toast.error(t("selectFiles")); return }
    localStorage.setItem("doc_import_processor_id", processorId)
    const type = selectedProcessor?.type || "MinerU"
    try {
      const tasksResp = await importFromSourceMutation.mutateAsync({
        id: selectedDsId,
        payload: {
          keys: Array.from(selectedKeys),
          site_id: siteId,
          collection_id: Number(collectionId),
          processor_type: type,
          ocr_enabled: ocrEnabled,
          extract_images: extractImages,
          extract_tables: extractTables,
          duplicate_strategy: skipDuplicates ? "skip" : "allow",
          generate_summary: generateSummary,
          generate_tags: generateTags,
          auto_vectorize: autoVectorize,
        },
      })
      // backend ``importFromDataSource`` response_model 标注为 ``dict``（实际返回
      // ``Task[]``），SDK 由此生成 ``Record<string, unknown> | null``。
      // 双重 cast 是无奈但必要的（类型完全不同；改善需要后端修 response_model）。
      const tasks: Task[] = Array.isArray(tasksResp) ? (tasksResp as unknown as Task[]) : []
      if (tasks.length > 0) {
        addTasks(tasks)
        toast.success(t("importSuccess", { count: tasks.length }))
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.info(t("allSkipped"))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("importFailed"))
    }
  }

  const handleSubmit = () => {
    if (!collectionId) { toast.error(t("selectCollection")); return }
    if (!processorId) { toast.error(t("selectParser")); return }
    if (activeTab === "upload") submitUpload()
    else submitDataSourceImport()
  }

  const fileCount = browseFiles.filter(f => f.type === "file").length
  const allSelected = fileCount > 0 && selectedKeys.size === fileCount
  const canSubmit = !!collectionId && !!processorId && !isSubmitting &&
    (activeTab === "upload" ? files.length > 0 : selectedKeys.size > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as SourceTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {t("tabUpload")}
              </TabsTrigger>
              <TabsTrigger value="datasource" className="gap-1.5">
                <Database className="h-3.5 w-3.5" />
                {t("tabDataSource")}
              </TabsTrigger>
            </TabsList>

            {/* ---------- 上传 Tab ---------- */}
            <TabsContent value="upload" className="mt-4 space-y-3">
              <div
                className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
                  files.length > 0
                    ? "border-primary/50 bg-primary/5"
                    : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                }`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); acceptFiles(e.dataTransfer.files) }}
                onClick={() => document.getElementById("doc-import-file-input")?.click()}
              >
                <input
                  id="doc-import-file-input"
                  type="file" className="hidden" accept={acceptTypes} multiple
                  onChange={e => acceptFiles(e.target.files)}
                />
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="font-medium text-slate-600">{t("dropzone")}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedTypeInfo?.formats?.join(", ") || "PDF"}
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-start justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-7 w-7 bg-white rounded flex items-center justify-center shrink-0 border border-slate-100">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-900 break-all">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-500 shrink-0"
                        onClick={e => { e.stopPropagation(); removeFile(index) }}
                        disabled={isSubmitting}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ---------- 数据源 Tab ---------- */}
            <TabsContent value="datasource" className="mt-4 space-y-3">
              {isLoadingDataSources ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t("loading")}
                </div>
              ) : dataSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl text-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{t("noSourcesTitle")}</p>
                    <p className="text-xs text-slate-500 max-w-sm">{t("noSourcesDesc")}</p>
                  </div>
                  <Button size="sm" onClick={goAddDataSource} className="gap-1.5 mt-1">
                    <Plus className="h-3.5 w-3.5" />
                    {t("goConfigureSource")}
                  </Button>
                </div>
              ) : (
                <>
              <div className="space-y-1.5">
                <Label>{t("selectSource")}</Label>
                <Select
                  value={selectedDsId?.toString() ?? ""}
                  onValueChange={v => setSelectedDsId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSourcePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map(ds => (
                      <SelectItem key={ds.id} value={ds.id.toString()}>
                        <span className="flex items-center gap-2">
                          <Database className="h-3.5 w-3.5 text-slate-400" />
                          {ds.name}
                          <span className="text-xs text-slate-400">
                            ({ds.type === "internal" ? t("typeInternal") : t("typeS3")})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("browseFiles")}</Label>
                  {browseStack.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleBrowseBack} className="h-7 px-2 text-xs gap-1">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("back")}
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  {browsePrefix && (
                    <div className="px-3 py-2 bg-slate-50 border-b text-xs text-slate-500 truncate font-mono">
                      {browsePrefix}
                    </div>
                  )}
                  <div className="min-h-[160px] max-h-[240px] overflow-y-auto">
                    {isBrowsing ? (
                      <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        {t("loading")}
                      </div>
                    ) : browseFiles.length === 0 ? (
                      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                        {t("emptyDir")}
                      </div>
                    ) : (
                      <>
                        {fileCount > 0 && (
                          <div
                            className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b cursor-pointer hover:bg-slate-100 text-xs text-slate-500"
                            onClick={toggleSelectAll}
                          >
                            {allSelected
                              ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                              : <Square className="h-4 w-4 text-slate-300 shrink-0" />}
                            {t("selectAll")} ({selectedKeys.size}/{fileCount})
                          </div>
                        )}
                        {browseFiles.map(item => (
                          <div
                            key={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer transition-colors ${
                              item.type === "dir"
                                ? "hover:bg-slate-50"
                                : selectedKeys.has(item.path)
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : "hover:bg-slate-50"
                            }`}
                            onClick={() => item.type === "dir" ? handleEnterDir(item) : toggleFileKey(item.path)}
                          >
                            {item.type === "dir" ? (
                              <>
                                <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                                <span className="text-sm flex-1 truncate">{item.name}</span>
                                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                              </>
                            ) : (
                              <>
                                {selectedKeys.has(item.path)
                                  ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                                  : <Square className="h-4 w-4 text-slate-300 shrink-0" />}
                                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="text-sm flex-1 truncate">{item.name}</span>
                                {item.size != null && (
                                  <span className="text-xs text-slate-400 shrink-0">{formatSize(item.size)}</span>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {selectedKeys.size > 0 && (
                  <p className="text-xs text-primary">{t("selected", { count: selectedKeys.size })}</p>
                )}
              </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* ---------- 共享配置 ---------- */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("parser")}</Label>
                <Select value={processorId} onValueChange={handleProcessorChange} disabled={processors.length === 0 || isLoadingProcessors}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingProcessors ? t("loading") : (processors.length === 0 ? t("noParser") : t("selectParser"))} />
                  </SelectTrigger>
                  <SelectContent>
                    {processors.map(p => {
                      const typeInfo = DOC_PROCESSOR_TYPES.find(ti => ti.value === p.type)
                      const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
                      const Icon = typeInfo ? icons[typeInfo.icon] || FileText : FileText
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={typeInfo?.disabled}>
                          <div className="flex items-center gap-2 w-full min-w-0">
                            {typeInfo?.icon.startsWith("/") ? (
                              <Image src={typeInfo.icon} alt="" width={16} height={16} className="object-contain shrink-0" />
                            ) : (
                              <Icon className={`h-4 w-4 shrink-0 ${typeInfo?.color.split(" ")[0] || "text-slate-500"}`} />
                            )}
                            <span className="truncate font-medium flex-1">{p.name}</span>
                            <span className="text-xs text-slate-400 shrink-0 opacity-70">({p.type})</span>
                            {p.origin === "platform" && (
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

            {hasProcessorOptions && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">{t("parseOptions")}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t("ocr")}</Label>
                    <p className="text-xs text-slate-500">
                      {selectedProcessor?.type === "Docling" ? t("ocrDescDocling") : t("ocrDescDefault")}
                    </p>
                  </div>
                  <Switch checked={ocrEnabled} onCheckedChange={setOcrEnabled} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t("extractImages")}</Label>
                    <p className="text-xs text-slate-500">{t("extractImagesDesc")}</p>
                  </div>
                  <Switch checked={extractImages} onCheckedChange={setExtractImages} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t("extractTables")}</Label>
                    <p className="text-xs text-slate-500">{t("extractTablesDesc")}</p>
                  </div>
                  <Switch checked={extractTables} onCheckedChange={setExtractTables} />
                </div>
              </div>
            )}

            {collectionId && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">{t("importOptions")}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{t("skipDuplicates")}</Label>
                    <p className="text-xs text-slate-500 mt-0.5">{t("skipDuplicatesDesc")}</p>
                  </div>
                  <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{t("autoVectorize")}</Label>
                    <p className="text-xs text-slate-500 mt-0.5">{t("autoVectorizeDesc")}</p>
                  </div>
                  <Switch checked={autoVectorize} onCheckedChange={setAutoVectorize} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{t("generateSummary")}</Label>
                    <p className="text-xs text-slate-500 mt-0.5">{t("generateSummaryDesc")}</p>
                  </div>
                  <Switch checked={generateSummary} onCheckedChange={setGenerateSummary} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{t("generateTags")}</Label>
                    <p className="text-xs text-slate-500 mt-0.5">{t("generateTagsDesc")}</p>
                  </div>
                  <Switch checked={generateTags} onCheckedChange={setGenerateTags} />
                </div>
              </div>
            )}

            {isSubmitting && activeTab === "upload" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{currentUploadingFile}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {activeTab === "upload"
              ? (isSubmitting ? t("processing") : t("submitUpload", { count: files.length }))
              : t("submitImport", { count: selectedKeys.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
