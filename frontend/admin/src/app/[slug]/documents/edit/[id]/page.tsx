// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Save, Send, ExternalLink, Clock, User, Info, Loader2, Database } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { DocumentStatus } from "@/lib/api-client"
import { toast } from "sonner"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { useSiteData, useDocument, useCollectionTree, useUpdateDocument, documentKeys } from "@/hooks"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { env } from "@/lib/env"
import { useQueryClient } from "@tanstack/react-query"
import {
  DocumentEditorContent, DocumentEditorSidebar, MetaRow,
  flattenCollections, type DocumentFormData,
} from "@/components/features/documents/DocumentEditorShared"

export default function EditDocumentPage() {
  const router = useRouter()
  const params = useParams()
  const routeContext = useRouteContext()
  const t = useTranslations("Documents")
  const locale = useLocale()
  const queryClient = useQueryClient()
  const documentId = parseInt(params.id as string)
  const currentSite = useSiteData()
  const siteId = currentSite.id
  const tenantSlug = currentSite.tenant_slug || 'default'

  const [form, setForm] = useState<DocumentFormData>({
    title: "", summary: "", tags: [], coverImage: null, collectionId: "", content: "",
  })
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null)
  const [status, setStatus] = useState<DocumentStatus>(DocumentStatus.DRAFT)

  const updateField = <K extends keyof DocumentFormData>(field: K, value: DocumentFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const { data: document, isLoading: documentLoading } = useDocument(documentId)
  const { data: collectionsTree, isLoading: collectionsLoading } = useCollectionTree(siteId, false)
  const updateDocumentMutation = useUpdateDocument()
  const collections = collectionsTree ? flattenCollections(collectionsTree) : []
  const loading = documentLoading || collectionsLoading

  // 文档数据加载后填充表单
  useEffect(() => {
    if (document) {
      const coverImg = document.cover_image || null
      setForm({
        title: document.title,
        summary: document.summary || "",
        tags: document.tags || [],
        coverImage: coverImg,
        collectionId: document.collection_id ? document.collection_id.toString() : "",
        content: document.content || "",
      })
      setOriginalCoverImage(coverImg)
      if (document.status === DocumentStatus.DRAFT || document.status === DocumentStatus.PUBLISHED) {
        setStatus(document.status)
      }
    }
  }, [document])

  const handleBack = () => router.push(getRoutePath("/documents", routeContext.slug))

  const handlePreview = () => {
    const slug = routeContext.slug || currentSite.slug || 'demo'
    window.open(`${env.NEXT_PUBLIC_CLIENT_URL}/${tenantSlug}/${slug}?documentId=${documentId}`, '_blank')
  }

  const handleSave = async (newStatus?: DocumentStatus) => {
    if (!form.title.trim()) { toast.error(t("newDoc.errorTitle")); return }
    if (!form.collectionId) { toast.error(t("newDoc.errorCollection")); return }

    const targetStatus = newStatus || status

    updateDocumentMutation.mutate({
      documentId,
      data: {
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        cover_image: form.coverImage,
        tags: form.tags,
        content: form.content || undefined,
        collection_id: parseInt(form.collectionId),
        status: targetStatus,
      }
    }, {
      onSuccess: async () => {
        // 封面图变更时删除旧图
        if (originalCoverImage && originalCoverImage !== form.coverImage) {
          try {
            const url = new URL(originalCoverImage)
            const pathParts = url.pathname.split('/').filter(Boolean)
            const objectName = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts.join('/')
            await api.file.deleteFile(objectName)
          } catch {
            // 删除失败不影响主流程
          }
        }

        await queryClient.invalidateQueries({ queryKey: documentKeys.lists(), refetchType: 'all' })
        toast.success(targetStatus === DocumentStatus.PUBLISHED ? t("newDoc.successPublish") : t("newDoc.successSave"))
        router.push(getRoutePath("/documents", routeContext.slug))
      }
    })
  }

  if (loading && !document) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-muted-foreground">{t("config.collectionsLoading")}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* 页面标题 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:bg-slate-100" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("editDoc.title")}</h1>
              <span className="text-slate-300 font-mono text-sm mt-1">#{documentId}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{t("editDoc.description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-11 px-6" onClick={handleBack} disabled={updateDocumentMutation.isPending}>
            {t("newDoc.cancel")}
          </Button>
          <Button variant="outline" className="flex items-center gap-2 h-11 px-6" onClick={handlePreview}>
            <ExternalLink className="h-4 w-4" />{t("editDoc.preview")}
          </Button>
          <Button variant="outline" className="flex items-center gap-2 h-11 px-6" onClick={() => handleSave(DocumentStatus.DRAFT)} disabled={updateDocumentMutation.isPending}>
            <Save className="h-4 w-4" />{t("newDoc.saveDraft")}
          </Button>
          <Button className="flex items-center gap-2 h-11 px-8" onClick={() => handleSave(DocumentStatus.PUBLISHED)} disabled={updateDocumentMutation.isPending}>
            {updateDocumentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {updateDocumentMutation.isPending ? t("newDoc.saving") : t("editDoc.saveAndPublish")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-9 space-y-6">
          <DocumentEditorContent form={form} onChange={updateField} />
        </div>
        <div className="col-span-3 space-y-6">
          <DocumentEditorSidebar
            form={form} onChange={updateField}
            collections={collections} collectionsLoading={loading}
            siteId={siteId} isPending={updateDocumentMutation.isPending}
          >
            <MetaRow icon={Info} label={t("editDoc.status")}>
              <Badge variant={status === DocumentStatus.PUBLISHED ? "default" : "outline"} className={cn(
                "text-[10px] font-bold border-none",
                status === DocumentStatus.PUBLISHED ? "bg-emerald-50 text-emerald-600" : "bg-white border-slate-200 text-slate-500"
              )}>
                {status === DocumentStatus.PUBLISHED ? t("config.published") : t("config.draft")}
              </Badge>
            </MetaRow>
            <MetaRow icon={Clock} label={t("editDoc.lastUpdated")}>
              <span className="text-xs font-bold text-slate-700">
                {document?.updated_at ? new Date(document.updated_at).toLocaleString(locale, {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', hour12: false,
                }) : "-"}
              </span>
            </MetaRow>
            <MetaRow icon={User} label={t("editDoc.author")}>
              <span className="text-xs font-bold text-slate-700">{document?.author || "Admin"}</span>
            </MetaRow>
            {document?.parse_meta && (
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none bg-slate-50/50 p-3 rounded-xl hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">解析元数据</span>
                  </div>
                  <span className="text-[10px] text-slate-400 group-open:hidden">{String(document.parse_meta.processor_type ?? "")}</span>
                  <span className="text-[10px] text-slate-400 hidden group-open:inline">收起</span>
                </summary>
                <div className="mt-1 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden text-[11px]">
                  {Object.entries(document.parse_meta).map(([k, v]) => (
                    <div key={k} className="flex gap-2 px-3 py-1.5 bg-white">
                      <span className="text-slate-400 shrink-0 w-28">{k}</span>
                      <span className="text-slate-600 break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </DocumentEditorSidebar>
        </div>
      </div>

    </div>
  )
}
