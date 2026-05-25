// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, DraftRestoreDialog } from "@/components/ui"
import { FileText, Save, Send, Clock, User, Info, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { DocumentStatus } from "@/lib/sdk/sdk.schemas"
import { toast } from "sonner"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { useSiteData, useCollectionTree, useCreateDocument, useAutosave, useDraftRestore } from "@/hooks"
import { getUserInfo } from "@/lib/auth"
import { useQueryClient } from "@tanstack/react-query"
import {
  DocumentEditorContent, DocumentEditorSidebar, MetaRow,
  flattenCollections, type DocumentFormData,
} from "@/components/features/documents/DocumentEditorShared"

export default function NewDocumentPage() {
  const router = useRouter()
  const routeContext = useRouteContext()
  const t = useTranslations("Documents")
  const queryClient = useQueryClient()
  const currentSite = useSiteData()
  const siteId = currentSite.id

  const [form, setForm] = useState<DocumentFormData>({
    title: "", summary: "", tags: [], coverImage: null, collectionId: "", content: "",
  })

  const updateField = <K extends keyof DocumentFormData>(field: K, value: DocumentFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const { data: collectionsTree, isLoading: collectionsLoading } = useCollectionTree(siteId, false)
  const createDocumentMutation = useCreateDocument(siteId)
  const collections = collectionsTree ? flattenCollections(collectionsTree) : []

  // 草稿
  const draftKey = `draft-new-${siteId}`
  const { hasDraft, restoreDraft, discardDraft, savedTimeAgo } = useDraftRestore(draftKey)
  const { clearDraft, isSaving, lastSavedTime } = useAutosave(form, draftKey, 2000, true)

  const handleRestoreDraft = () => {
    const draft = restoreDraft()
    if (draft) {
      setForm({
        title: draft.title || "",
        content: draft.content || "",
        summary: draft.summary || "",
        tags: draft.tags || [],
        coverImage: draft.coverImage || null,
        collectionId: draft.collectionId || "",
      })
      toast.success(t("newDoc.draftRestored"))
    }
  }

  const handleSave = (status: DocumentStatus) => {
    if (!form.title.trim()) { toast.error(t("newDoc.errorTitle")); return }
    if (!form.collectionId) { toast.error(t("newDoc.errorCollection")); return }

    const userInfo = getUserInfo()
    createDocumentMutation.mutate({
      site_id: siteId,
      title: form.title.trim(),
      summary: form.summary.trim() || undefined,
      cover_image: form.coverImage,
      tags: form.tags,
      content: form.content || undefined,
      collection_id: parseInt(form.collectionId),
      author: userInfo?.name || userInfo?.email || "Admin",
      status,
    }, {
      onSuccess: async () => {
        clearDraft()
        await queryClient.invalidateQueries({ queryKey: ["/admin/v1/documents"], refetchType: "all" })
        toast.success(status === "published" as const ? t("newDoc.successPublish") : t("newDoc.successSave"))
        router.push(getRoutePath("/documents", routeContext.slug))
      }
    })
  }

  return (
    <>
      <DraftRestoreDialog
        open={hasDraft}
        onRestore={handleRestoreDraft}
        onDiscard={() => { discardDraft(); toast.info(t("newDoc.draftDiscarded")) }}
        savedTimeAgo={savedTimeAgo}
      />

      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        {/* 页面标题 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("newDoc.title")}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground text-sm">{t("newDoc.description")}</p>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>
                    {isSaving ? t("newDoc.saving") : lastSavedTime ? t("newDoc.savedAt", { time: lastSavedTime.toLocaleTimeString() }) : t("newDoc.waitingInput")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-11 px-6" onClick={() => router.push(getRoutePath("/documents", routeContext.slug))} disabled={createDocumentMutation.isPending}>
              {t("newDoc.cancel")}
            </Button>
            <Button variant="outline" className="flex items-center gap-2 h-11 px-6" onClick={() => handleSave("draft" as const)} disabled={createDocumentMutation.isPending}>
              <Save className="h-4 w-4" />{t("newDoc.saveDraft")}
            </Button>
            <Button className="flex items-center gap-2 h-11 px-8" onClick={() => handleSave("published" as const)} disabled={createDocumentMutation.isPending}>
              {createDocumentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {createDocumentMutation.isPending ? t("newDoc.saving") : t("newDoc.publish")}
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
              collections={collections} collectionsLoading={collectionsLoading}
              siteId={siteId} isPending={createDocumentMutation.isPending}
            >
              <MetaRow icon={Info} label={t("editDoc.status")}>
                <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-500 font-bold">{t("config.draft")}</Badge>
              </MetaRow>
              <MetaRow icon={User} label={t("editDoc.author")}>
                <span className="text-xs font-bold text-slate-700">{getUserInfo()?.name || getUserInfo()?.email || "Admin"}</span>
              </MetaRow>
            </DocumentEditorSidebar>
          </div>
        </div>

      </div>
    </>
  )
}
