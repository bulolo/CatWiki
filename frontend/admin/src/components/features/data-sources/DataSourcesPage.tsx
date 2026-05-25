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

import { Fragment, useRef, useState, type ChangeEvent } from "react"
import { useTranslations } from "next-intl"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAdminMutation } from "@/hooks/useAdminMutation"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useConfirm } from "@/components/ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import {
  Database, Plus, Pencil, Trash2, Loader2, Server, Info, X, Check,
  FolderOpen, Folder, FileText, ChevronRight, ArrowLeft, RefreshCw, Upload,
} from "lucide-react"
import { toast } from "sonner"
import { browseDataSource, createDataSource, deleteDataSource, deleteDataSourceFile, listDataSources, updateDataSource, uploadToDataSource } from "@/lib/sdk/admin-data-sources"
import type { DataSource, DataSourceCreate, DataSourceUpdate, S3FileItem } from "@/lib/sdk/sdk.schemas"

const DATA_SOURCES_KEY = ["data-sources"] as const
const DATA_SOURCE_BROWSE_KEY = (id: number | null, prefix: string) =>
  ["data-source-browse", id, prefix] as const

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface FormState {
  name: string
  type: "internal" | "s3"
  description: string
  endpoint: string
  bucket_name: string
  access_key: string
  secret_key: string
  use_ssl: boolean
  root_prefix: string    // 用户填写的部分，保存到后端
  tenant_base: string    // 租户自动前缀（如 acme-corp/），不可编辑，仅用于路径预览
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "internal",
  description: "",
  endpoint: "",
  bucket_name: "",
  access_key: "",
  secret_key: "",
  use_ssl: true,
  root_prefix: "",
  tenant_base: "",
}

export function DataSourcesPage() {
  const t = useTranslations("DataSources")
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  // —————————————— 数据源列表 ——————————————
  const { data: sources = [], isLoading } = useQuery({
    queryKey: DATA_SOURCES_KEY,
    queryFn: async () => {
      try {
        return (await listDataSources()) ?? []
      } catch {
        toast.error(t("loadFailed"))
        throw new Error("load failed")
      }
    },
  })

  // —————————————— 表单状态 ——————————————
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // —————————————— 文件浏览状态 ——————————————
  const [browsingId, setBrowsingId] = useState<number | null>(null)
  const [browsePrefix, setBrowsePrefix] = useState("")
  const [browseStack, setBrowseStack] = useState<string[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const { data: browseFiles = [], isFetching: isBrowsing } = useQuery({
    queryKey: DATA_SOURCE_BROWSE_KEY(browsingId, browsePrefix),
    queryFn: async () => {
      if (browsingId === null) return [] as S3FileItem[]
      try {
        return (await browseDataSource(browsingId, { prefix: browsePrefix })) ?? []
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : t("browseFailed"))
        return [] as S3FileItem[]
      }
    },
    enabled: browsingId !== null,
  })

  const invalidateBrowse = () => {
    if (browsingId !== null) {
      queryClient.invalidateQueries({ queryKey: DATA_SOURCE_BROWSE_KEY(browsingId, browsePrefix) })
    }
  }

  // —————————————— Mutations ——————————————
  const createMutation = useAdminMutation({
    mutationFn: (data: DataSourceCreate) => createDataSource(data),
    successMsg: t("createSuccess"),
    invalidateKeys: [DATA_SOURCES_KEY],
  })

  const updateMutation = useAdminMutation({
    mutationFn: ({ id, data }: { id: number; data: DataSourceUpdate }) => updateDataSource(id, data),
    successMsg: t("updateSuccess"),
    invalidateKeys: [DATA_SOURCES_KEY],
  })

  const deleteMutation = useAdminMutation({
    mutationFn: (id: number) => deleteDataSource(id),
    successMsg: t("deleteSuccess"),
    invalidateKeys: [DATA_SOURCES_KEY],
  })

  const uploadMutation = useAdminMutation({
    mutationFn: ({ id, file, prefix }: { id: number; file: File; prefix: string }) =>
      uploadToDataSource(id, { file, prefix }),
    successMsg: (_data, vars) => t("uploadSuccess", { name: vars.file.name }),
    onSuccess: () => invalidateBrowse(),
  })

  const deleteFileMutation = useAdminMutation({
    mutationFn: ({ id, key }: { id: number; key: string }) => deleteDataSourceFile(id, { key }),
    successMsg: t("deleteFileSuccess"),
    onSuccess: () => invalidateBrowse(),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const deletingId = deleteMutation.isPending ? deleteMutation.variables : null
  const deletingKey = deleteFileMutation.isPending ? deleteFileMutation.variables?.key : null
  const isUploading = uploadMutation.isPending

  // —————————————— Handlers ——————————————
  const handleStartAdd = () => {
    setEditingId(null)
    setIsAdding(true)
    setForm(EMPTY_FORM)
  }

  const handleStartEdit = (ds: DataSource) => {
    setIsAdding(false)
    setEditingId(ds.id)
    const cfg = ds.config as Record<string, unknown>
    setForm({
      name: ds.name,
      type: ds.type as "internal" | "s3",
      description: ds.description ?? "",
      endpoint: (cfg.endpoint as string) ?? "",
      bucket_name: (cfg.bucket_name as string) ?? "",
      access_key: (cfg.access_key as string) ?? "",
      secret_key: "****",
      use_ssl: (cfg.use_ssl as boolean) ?? true,
      root_prefix: (cfg.user_root_prefix as string) ?? "",
      tenant_base: (() => {
        const full = (cfg.root_prefix as string) ?? ""
        const user = (cfg.user_root_prefix as string) ?? ""
        return full.slice(0, full.length - user.length)
      })(),
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t("nameRequired")); return }
    if (form.type === "s3") {
      if (!form.endpoint.trim()) { toast.error(t("endpointRequired")); return }
      if (!form.bucket_name.trim()) { toast.error(t("bucketRequired")); return }
      if (!form.access_key.trim()) { toast.error(t("accessKeyRequired")); return }
      if (!editingId && !form.secret_key.trim()) { toast.error(t("secretKeyRequired")); return }
    }

    const config = form.type === "s3"
      ? {
          endpoint: form.endpoint,
          bucket_name: form.bucket_name,
          access_key: form.access_key,
          secret_key: form.secret_key,
          use_ssl: form.use_ssl,
          root_prefix: form.root_prefix,
        }
      : { root_prefix: form.root_prefix }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          data: { name: form.name, description: form.description || undefined, config } as DataSourceUpdate,
        })
      } else {
        await createMutation.mutateAsync({
          name: form.name,
          type: form.type,
          description: form.description || undefined,
          config,
        } as DataSourceCreate)
      }
      handleCancel()
    } catch {
      // useAdminMutation 已经 toast.error
    }
  }

  const handleDelete = async (id: number) => {
    const target = sources.find(s => s.id === id)
    if (!await confirm({
      description: t("deleteConfirm", { name: target?.name ?? "" }),
      variant: "destructive",
    })) return
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (browsingId === id) setBrowsingId(null)
      },
    })
  }

  const handleToggleBrowse = (ds: DataSource) => {
    if (browsingId === ds.id) {
      setBrowsingId(null)
      setBrowsePrefix("")
      setBrowseStack([])
      return
    }
    setBrowsingId(ds.id)
    setBrowsePrefix("")
    setBrowseStack([])
  }

  const handleEnterDir = (item: S3FileItem) => {
    if (browsingId === null) return
    setBrowseStack(prev => [...prev, browsePrefix])
    setBrowsePrefix(item.path)
  }

  const handleBrowseBack = () => {
    if (browseStack.length === 0) return
    const prev = browseStack[browseStack.length - 1]
    setBrowseStack(s => s.slice(0, -1))
    setBrowsePrefix(prev)
  }

  const handleBrowseRefresh = () => invalidateBrowse()

  const handleUploadClick = () => uploadInputRef.current?.click()

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || browsingId === null) return
    uploadMutation.mutate({ id: browsingId, file, prefix: browsePrefix })
  }

  const handleDeleteBrowseFile = async (item: S3FileItem) => {
    if (browsingId === null) return
    if (!await confirm({ description: t("deleteFileConfirm", { name: item.name }), variant: "destructive" })) return
    deleteFileMutation.mutate({ id: browsingId, key: item.path })
  }

  const renderBrowser = () => (
    <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-slate-50/60 border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0 flex-1">
          <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-mono truncate">{browsePrefix || "/"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {browseStack.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleBrowseBack} className="h-7 px-2 text-xs gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("back")}
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleUploadClick}
            disabled={isUploading}
            title={t("uploadHere")}
          >
            {isUploading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />
            }
            {t("upload")}
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            className="hidden"
            onChange={handleFilePicked}
          />
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7"
            onClick={handleBrowseRefresh}
            disabled={isBrowsing}
            title={t("refresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isBrowsing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7"
            onClick={() => setBrowsingId(null)}
            title={t("close")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {isBrowsing ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t("loading")}
          </div>
        ) : browseFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <Folder className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t("emptyDir")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {browseFiles.map(item => (
              <div
                key={item.path}
                className={`group flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  item.type === "dir" ? "cursor-pointer hover:bg-white" : "hover:bg-white"
                }`}
                onClick={() => item.type === "dir" && handleEnterDir(item)}
              >
                {item.type === "dir" ? (
                  <>
                    <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="flex-1 truncate text-slate-700">{item.name}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="flex-1 truncate text-slate-600">{item.name}</span>
                    {item.size != null && (
                      <span className="text-xs text-slate-400 shrink-0">{formatSize(item.size)}</span>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                      disabled={deletingKey === item.path}
                      onClick={(e) => { e.stopPropagation(); handleDeleteBrowseFile(item) }}
                      title={t("deleteFile")}
                    >
                      {deletingKey === item.path
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderForm = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {editingId ? t("editTitle") : t("createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("fieldName")} *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fieldType")}</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as "internal" | "s3" }))}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{t("typeInternal")}</SelectItem>
                  <SelectItem value="s3">{t("typeS3")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("fieldDescription")}</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          {form.type === "internal" && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2.5">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">{t("internalHintDesc")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("fieldRootPrefix")}</Label>
            <Input
              value={form.root_prefix}
              onChange={e => setForm(f => ({ ...f, root_prefix: e.target.value }))}
              placeholder={form.type === "internal" ? "uploads/" : "docs/"}
            />
            <p className="text-xs text-slate-400">
              {form.type === "internal" ? t("rootPrefixHintInternal") : t("rootPrefixHintS3")}
            </p>
          </div>

          {form.type === "internal" && editingId && form.endpoint && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">{t("internalStoragePath")}</Label>
              <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 font-mono text-xs text-slate-600 break-all">
                {[form.endpoint, form.bucket_name, form.tenant_base + (form.root_prefix || "")].filter(Boolean).join("/")}
              </div>
            </div>
          )}

          {form.type === "s3" && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">S3 {t("connectionConfig")}</p>

              <div className="space-y-1.5">
                <Label>{t("fieldEndpoint")} *</Label>
                <Input
                  value={form.endpoint}
                  onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
                  placeholder="s3.amazonaws.com 或 minio.example.com:9000"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("fieldBucket")} *</Label>
                <Input
                  value={form.bucket_name}
                  onChange={e => setForm(f => ({ ...f, bucket_name: e.target.value }))}
                  placeholder="my-documents"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("fieldAccessKey")} *</Label>
                  <Input
                    value={form.access_key}
                    onChange={e => setForm(f => ({ ...f, access_key: e.target.value }))}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("fieldSecretKey")} {!editingId && "*"}</Label>
                  <Input
                    type="password"
                    value={form.secret_key}
                    onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))}
                    placeholder={editingId ? t("secretKeyKeep") : "wJalrXUtnFEMI/K7MDENG"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.use_ssl}
                  onCheckedChange={v => setForm(f => ({ ...f, use_ssl: v }))}
                />
                <Label className="cursor-pointer">{t("fieldUseSSL")}</Label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {editingId ? t("save") : t("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t("title")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("subtitle")}</p>
        </div>
        {!isAdding && editingId === null && (
          <Button size="sm" onClick={handleStartAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("addSource")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {t("loading")}
        </div>
      ) : sources.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Database className="h-10 w-10 opacity-30" />
          <p className="text-sm">{t("empty")}</p>
          <Button variant="outline" size="sm" onClick={handleStartAdd}>{t("addFirst")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {isAdding && renderForm()}

          {sources.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colType")}</TableHead>
                  <TableHead>{t("colPath")}</TableHead>
                  <TableHead className="w-[100px]">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(ds => {
                  const cfg = ds.config as Record<string, unknown>

                  if (editingId === ds.id) {
                    return (
                      <TableRow key={ds.id}>
                        <TableCell colSpan={4} className="p-2">
                          {renderForm()}
                        </TableCell>
                      </TableRow>
                    )
                  }

                  const isBrowsingThis = browsingId === ds.id
                  return (
                    <Fragment key={ds.id}>
                      <TableRow className={isBrowsingThis ? "bg-slate-50/50" : undefined}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {ds.type === "internal"
                              ? <Server className="h-4 w-4 text-slate-400" />
                              : <Database className="h-4 w-4 text-slate-400" />
                            }
                            {ds.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ds.type === "internal" ? "secondary" : "outline"}>
                            {ds.type === "internal" ? t("typeInternal") : "S3"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm font-mono max-w-[280px]">
                          <span className={ds.type === "internal" ? "text-slate-600 break-all" : "break-all"}>
                            {(cfg.endpoint as string)
                              ? [cfg.endpoint, cfg.bucket_name, cfg.root_prefix].filter(Boolean).join("/")
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className={`h-7 w-7 ${isBrowsingThis ? "text-primary bg-primary/10" : ""}`}
                              onClick={() => handleToggleBrowse(ds)}
                              title={t("browseFiles")}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7"
                              onClick={() => handleStartEdit(ds)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              disabled={deletingId === ds.id}
                              onClick={() => handleDelete(ds.id)}
                            >
                              {deletingId === ds.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isBrowsingThis && (
                        <TableRow>
                          <TableCell colSpan={4} className="p-2 bg-slate-50/30">
                            {renderBrowser()}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
