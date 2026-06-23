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

import { useTranslations } from "next-intl"
import Image from "next/image"
import { Label, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { type LucideIcon, Bird, Zap, Scan, BookOpen, Pickaxe, Globe, FileText } from "lucide-react"
import { DOC_PROCESSOR_TYPES, type DocProcessorType } from "@/types/settings"
import type { DocProcessor } from "./helpers"

interface ConfigPanelProps {
  processors: DocProcessor[]
  isLoadingProcessors: boolean
  processorId: string
  onProcessorChange: (id: string) => void
  selectedProcessorType?: DocProcessorType
  hasProcessorOptions: boolean
  flattenedCollections: { id: string; name: string; level: number }[]
  collectionId: string
  onCollectionChange: (id: string) => void
  ocrEnabled: boolean
  setOcrEnabled: (v: boolean) => void
  extractImages: boolean
  setExtractImages: (v: boolean) => void
  extractTables: boolean
  setExtractTables: (v: boolean) => void
  skipDuplicates: boolean
  setSkipDuplicates: (v: boolean) => void
  autoVectorize: boolean
  setAutoVectorize: (v: boolean) => void
  generateSummary: boolean
  setGenerateSummary: (v: boolean) => void
  generateTags: boolean
  setGenerateTags: (v: boolean) => void
  showProgress: boolean
  uploadProgress: number
  currentUploadingFile: string
}

export function ConfigPanel({
  processors, isLoadingProcessors, processorId, onProcessorChange, selectedProcessorType, hasProcessorOptions,
  flattenedCollections, collectionId, onCollectionChange,
  ocrEnabled, setOcrEnabled, extractImages, setExtractImages, extractTables, setExtractTables,
  skipDuplicates, setSkipDuplicates, autoVectorize, setAutoVectorize,
  generateSummary, setGenerateSummary, generateTags, setGenerateTags,
  showProgress, uploadProgress, currentUploadingFile,
}: ConfigPanelProps) {
  const t = useTranslations("DocImport")
  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("parser")}</Label>
          <Select value={processorId} onValueChange={onProcessorChange} disabled={processors.length === 0 || isLoadingProcessors}>
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
          <Select value={collectionId} onValueChange={onCollectionChange}>
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
                {selectedProcessorType === "Docling" ? t("ocrDescDocling") : t("ocrDescDefault")}
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

      {showProgress && (
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
  )
}
