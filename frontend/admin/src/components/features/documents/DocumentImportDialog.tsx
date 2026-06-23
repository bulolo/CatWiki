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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui"
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { Loader2, Upload, Database } from "lucide-react"
import { toast } from "sonner"
import { browseDataSource, importFromDataSource, listDataSources } from "@/lib/sdk/admin-data-sources"
import { importDocument } from "@/lib/sdk/admin-documents"
import { getAdminDocProcessorConfig } from "@/lib/sdk/admin-system-configs"
import type { S3FileItem, Task } from "@/lib/sdk/sdk.schemas"
import { toImportDocumentBody } from "@/lib/normalizers"
import { DOC_PROCESSOR_TYPES } from "@/types/settings"
import type { CollectionItem } from "@/types"
import { useTasks } from "@/contexts/TaskContext"
import { isRecord } from "@/lib/utils"
import {
  type DocProcessor, type SourceTab, FORMAT_TO_EXT, FORMAT_TO_MIME,
  flattenCollections, parseProcessorConfig, parseDocProcessorType, parseProcessorOrigin,
} from "./import/helpers"
import { UploadTab } from "./import/UploadTab"
import { DataSourceTab } from "./import/DataSourceTab"
import { ConfigPanel } from "./import/ConfigPanel"

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
    ? DOC_PROCESSOR_TYPES.find(ti => ti.value === selectedProcessor.type)
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

            <TabsContent value="upload" className="mt-4 space-y-3">
              <UploadTab
                files={files}
                acceptTypes={acceptTypes}
                formatHint={selectedTypeInfo?.formats?.join(", ") || "PDF"}
                isSubmitting={isSubmitting}
                onAcceptFiles={acceptFiles}
                onRemoveFile={removeFile}
              />
            </TabsContent>

            <TabsContent value="datasource" className="mt-4 space-y-3">
              <DataSourceTab
                isLoading={isLoadingDataSources}
                dataSources={dataSources}
                selectedDsId={selectedDsId}
                onSelectDs={setSelectedDsId}
                browsePrefix={browsePrefix}
                showBack={browseStack.length > 0}
                onBrowseBack={handleBrowseBack}
                isBrowsing={isBrowsing}
                browseFiles={browseFiles}
                fileCount={fileCount}
                allSelected={allSelected}
                selectedKeys={selectedKeys}
                onToggleSelectAll={toggleSelectAll}
                onToggleFileKey={toggleFileKey}
                onEnterDir={handleEnterDir}
                onGoAddDataSource={goAddDataSource}
              />
            </TabsContent>
          </Tabs>

          <ConfigPanel
            processors={processors}
            isLoadingProcessors={isLoadingProcessors}
            processorId={processorId}
            onProcessorChange={handleProcessorChange}
            selectedProcessorType={selectedProcessor?.type}
            hasProcessorOptions={hasProcessorOptions}
            flattenedCollections={flattenedCollections}
            collectionId={collectionId}
            onCollectionChange={setCollectionId}
            ocrEnabled={ocrEnabled}
            setOcrEnabled={setOcrEnabled}
            extractImages={extractImages}
            setExtractImages={setExtractImages}
            extractTables={extractTables}
            setExtractTables={setExtractTables}
            skipDuplicates={skipDuplicates}
            setSkipDuplicates={setSkipDuplicates}
            autoVectorize={autoVectorize}
            setAutoVectorize={setAutoVectorize}
            generateSummary={generateSummary}
            setGenerateSummary={setGenerateSummary}
            generateTags={generateTags}
            setGenerateTags={setGenerateTags}
            showProgress={isSubmitting && activeTab === "upload"}
            uploadProgress={uploadProgress}
            currentUploadingFile={currentUploadingFile}
          />
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
