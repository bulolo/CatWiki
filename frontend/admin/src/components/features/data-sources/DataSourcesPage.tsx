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
import { Badge, Button, useConfirm } from "@/components/ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { Database, Plus, Pencil, Trash2, Loader2, Server, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { browseDataSource, createDataSource, deleteDataSource, deleteDataSourceFile, listDataSources, updateDataSource, uploadToDataSource } from "@/lib/sdk/admin-data-sources"
import type { DataSource, DataSourceCreate, DataSourceUpdate, S3FileItem } from "@/lib/sdk/sdk.schemas"
import { type FormState, EMPTY_FORM } from "./form-state"
import { DataSourceForm } from "./DataSourceForm"
import { DataSourceBrowser } from "./DataSourceBrowser"

const DATA_SOURCES_KEY = ["data-sources"] as const
const DATA_SOURCE_BROWSE_KEY = (id: number | null, prefix: string) =>
  ["data-source-browse", id, prefix] as const

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

  const renderForm = () => (
    <DataSourceForm
      editingId={editingId}
      form={form}
      setForm={setForm}
      isSaving={isSaving}
      onCancel={handleCancel}
      onSave={handleSave}
    />
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
                            <DataSourceBrowser
                              browsePrefix={browsePrefix}
                              showBack={browseStack.length > 0}
                              isBrowsing={isBrowsing}
                              browseFiles={browseFiles}
                              isUploading={isUploading}
                              deletingKey={deletingKey}
                              uploadInputRef={uploadInputRef}
                              onBack={handleBrowseBack}
                              onUploadClick={handleUploadClick}
                              onFilePicked={handleFilePicked}
                              onRefresh={handleBrowseRefresh}
                              onClose={() => setBrowsingId(null)}
                              onEnterDir={handleEnterDir}
                              onDeleteFile={handleDeleteBrowseFile}
                            />
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
