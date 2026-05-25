// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardHeader, CardTitle, ImageUpload, Input, Popover, PopoverContent, PopoverTrigger, TagsInput, Textarea } from "@/components/ui"
import {
  Image as ImageIcon, Settings as SettingsIcon,
  Tags, Hash, Info, Plus, Loader2, Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { useAiGenerateFields } from "@/hooks/useDocuments"
import { LazyMarkdownEditor } from "@/components/editor"
import { CreateCollectionDialog } from "@/components/features/documents/CreateCollectionDialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import type { CollectionTree } from "@/lib/sdk/sdk.schemas"

type CollectionTreeWithLevel = CollectionTree & { level?: number }

export function flattenCollections(tree: CollectionTree[]): CollectionTreeWithLevel[] {
  const result: CollectionTreeWithLevel[] = []
  const flatten = (items: CollectionTree[], level = 0) => {
    items.forEach(item => {
      result.push({ ...item, level })
      if (item.children?.length) flatten(item.children, level + 1)
    })
  }
  flatten(tree)
  return result
}

export interface DocumentFormData {
  title: string
  summary: string
  tags: string[]
  coverImage: string | null
  collectionId: string
  content: string
}

interface DocumentEditorContentProps {
  form: DocumentFormData
  onChange: <K extends keyof DocumentFormData>(field: K, value: DocumentFormData[K]) => void
  collections: CollectionTreeWithLevel[]
  collectionsLoading: boolean
  siteId: number
  isPending: boolean
}

const AI_SUMMARY_MAX_LENGTH_KEY = "doc_ai_summary_max_length"
const AI_SUMMARY_MAX_LENGTH_DEFAULT = 150
const AI_TAGS_MAX_COUNT_KEY = "doc_ai_tags_max_count"
const AI_TAGS_MAX_COUNT_DEFAULT = 8
const AI_CONTENT_SEND_LIMIT = 6000

/** 左侧编辑器区域 */
export function DocumentEditorContent({
  form, onChange,
}: Pick<DocumentEditorContentProps, "form" | "onChange">) {
  const t = useTranslations("Documents")
  const aiGenerate = useAiGenerateFields()

  const [summaryMaxLength, setSummaryMaxLength] = useState<number>(() => {
    if (typeof window === "undefined") return AI_SUMMARY_MAX_LENGTH_DEFAULT
    const stored = localStorage.getItem(AI_SUMMARY_MAX_LENGTH_KEY)
    const parsed = stored ? parseInt(stored, 10) : NaN
    return Number.isNaN(parsed) ? AI_SUMMARY_MAX_LENGTH_DEFAULT : parsed
  })
  const [summaryMaxLengthInput, setSummaryMaxLengthInput] = useState(summaryMaxLength.toString())

  const handleGenerateSummary = async () => {
    const trimmed = form.content.trim()
    if (trimmed.length < 50) {
      toast.error(t("newDoc.aiContentTooShort"))
      return
    }
    const content = trimmed.slice(0, AI_CONTENT_SEND_LIMIT)
    const result = await aiGenerate.mutateAsync({ content, fields: ["summary"], summaryMaxLength })
    if (result?.summary) {
      onChange("summary", result.summary)
      toast.success(t("newDoc.aiGenerateSummarySuccess"))
    }
  }

  const handleSummaryMaxLengthChange = (value: string) => {
    setSummaryMaxLengthInput(value)
    const parsed = parseInt(value, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      setSummaryMaxLength(parsed)
      localStorage.setItem(AI_SUMMARY_MAX_LENGTH_KEY, parsed.toString())
    }
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-6 px-8 pt-8 space-y-4">
        <Input
          type="text"
          placeholder={t("newDoc.placeholderTitle")}
          className="text-3xl font-extrabold border-none focus-visible:ring-0 px-0 h-auto placeholder:text-slate-300 bg-transparent"
          value={form.title}
          onChange={(e) => onChange("title", e.target.value)}
        />
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-slate-400">
              <Info className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">{t("newDoc.summary")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] text-slate-400 hover:text-slate-600 tabular-nums transition-colors">
                    {form.summary.length} / {summaryMaxLength}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">{t("newDoc.aiCharLimit")}</p>
                    <Input
                      type="number"
                      min={20}
                      max={2000}
                      value={summaryMaxLengthInput}
                      onChange={(e) => handleSummaryMaxLengthChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary hover:text-primary/80 gap-1"
                onClick={handleGenerateSummary}
                disabled={aiGenerate.isPending}
              >
                {aiGenerate.isPending
                  ? <><Loader2 className="h-3 w-3 animate-spin" />{t("newDoc.aiGenerating")}</>
                  : <><Sparkles className="h-3 w-3" />{t("newDoc.aiGenerate")}</>
                }
              </Button>
            </div>
          </div>
          <Textarea
            placeholder={t("newDoc.placeholderSummary")}
            className="resize-none min-h-[80px] text-sm leading-relaxed text-slate-600 border-none bg-slate-50/50 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl px-4 py-3 placeholder:text-slate-400"
            value={form.summary}
            onChange={(e) => onChange("summary", e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 border-t border-slate-100">
        <div className="md-editor-container">
          <LazyMarkdownEditor
            value={form.content}
            onChange={(v) => onChange("content", v)}
            placeholder={t("newDoc.placeholderContent")}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/** 右侧配置侧边栏 */
export function DocumentEditorSidebar({
  form, onChange, collections, collectionsLoading, siteId, isPending, children,
}: DocumentEditorContentProps & { children?: React.ReactNode }) {
  const t = useTranslations("Documents")
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false)
  const aiGenerate = useAiGenerateFields()

  const [tagsMaxCount, setTagsMaxCount] = useState<number>(() => {
    if (typeof window === "undefined") return AI_TAGS_MAX_COUNT_DEFAULT
    const stored = localStorage.getItem(AI_TAGS_MAX_COUNT_KEY)
    const parsed = stored ? parseInt(stored, 10) : NaN
    return Number.isNaN(parsed) ? AI_TAGS_MAX_COUNT_DEFAULT : parsed
  })
  const [tagsMaxCountInput, setTagsMaxCountInput] = useState(tagsMaxCount.toString())

  const handleGenerateTags = async () => {
    const trimmed = form.content.trim()
    if (trimmed.length < 50) {
      toast.error(t("newDoc.aiContentTooShort"))
      return
    }
    const content = trimmed.slice(0, AI_CONTENT_SEND_LIMIT)
    const result = await aiGenerate.mutateAsync({ content, fields: ["tags"], tagsMaxCount })
    if (result?.tags?.length) {
      onChange("tags", result.tags)
      toast.success(t("newDoc.aiGenerateTagsSuccess"))
    }
  }

  const handleTagsMaxCountChange = (value: string) => {
    setTagsMaxCountInput(value)
    const parsed = parseInt(value, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      setTagsMaxCount(parsed)
      localStorage.setItem(AI_TAGS_MAX_COUNT_KEY, parsed.toString())
    }
  }

  return (
    <>
      <CreateCollectionDialog
        siteId={siteId}
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        onSuccess={(id) => onChange("collectionId", id.toString())}
        collections={collections}
      />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-muted/20 py-5 px-6">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <SettingsIcon className="h-4 w-4 text-primary" />
            </div>
            {t("config.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* 所属合集 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Hash className="h-4 w-4" />
              <label className="text-sm font-bold">{t("config.collection")}</label>
              <span className="text-red-500">*</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={form.collectionId} onValueChange={(v) => onChange("collectionId", v)} disabled={collectionsLoading}>
                <SelectTrigger className="flex-1 bg-slate-50/50 border-slate-200 h-10 rounded-xl">
                  <SelectValue placeholder={collectionsLoading ? t("config.collectionsLoading") : (collections.length === 0 ? t("config.noCollection") : t("config.collectionPlaceholder"))} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {collections.map((col) => (
                    <SelectItem key={col.id} value={col.id.toString()} className="text-sm">
                      <span style={{ paddingLeft: `${(col.level || 0) * 12}px` }}>{col.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button" variant="outline" size="icon"
                className="h-10 w-10 shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 transition-colors"
                onClick={() => setIsCreateCollectionOpen(true)}
                title={t("config.createCollection")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {collections.length === 0 && !collectionsLoading && (
              <p className="text-[10px] text-amber-600 font-medium">{t("config.noCollection")}</p>
            )}
          </div>

          {/* 标签 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Tags className="h-4 w-4" />
                <label className="text-sm font-bold">{t("config.tags")}</label>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-slate-400 hover:text-slate-600 tabular-nums transition-colors">
                      {form.tags.length} / {tagsMaxCount}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">{t("newDoc.aiTagsMaxCount")}</p>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={tagsMaxCountInput}
                        onChange={(e) => handleTagsMaxCountChange(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-primary hover:text-primary/80 gap-1"
                  onClick={handleGenerateTags}
                  disabled={aiGenerate.isPending}
                >
                  {aiGenerate.isPending
                    ? <><Loader2 className="h-3 w-3 animate-spin" />{t("newDoc.aiGenerating")}</>
                    : <><Sparkles className="h-3 w-3" />{t("newDoc.aiGenerate")}</>
                  }
                </Button>
              </div>
            </div>
            <TagsInput value={form.tags} onChange={(v) => onChange("tags", v)} placeholder={t("config.tagsPlaceholder")} />
          </div>

          {/* 封面图 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-slate-500">
              <ImageIcon className="h-4 w-4" />
              <label className="text-sm font-bold">{t("config.coverImage")}</label>
            </div>
            <ImageUpload value={form.coverImage} onChange={(v) => onChange("coverImage", v)} disabled={isPending} />
          </div>

          {/* 附加信息（由调用方注入） */}
          {children && (
            <div className="pt-6 border-t border-slate-100 space-y-4">
              {children}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** 附加信息行 */
export function MetaRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {children}
    </div>
  )
}

/** Markdown 编辑器样式 */
export function EditorStyles() {
  return null // 样式已移至 globals.css
}
