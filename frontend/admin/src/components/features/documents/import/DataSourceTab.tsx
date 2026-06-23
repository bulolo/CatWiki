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
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Loader2, Database, Folder, ChevronRight, ArrowLeft, CheckSquare, Square, Plus, FileText } from "lucide-react"
import type { DataSource, S3FileItem } from "@/lib/sdk/sdk.schemas"
import { formatSize } from "@/lib/utils"

interface DataSourceTabProps {
  isLoading: boolean
  dataSources: DataSource[]
  selectedDsId: number | null
  onSelectDs: (id: number) => void
  browsePrefix: string
  showBack: boolean
  onBrowseBack: () => void
  isBrowsing: boolean
  browseFiles: S3FileItem[]
  fileCount: number
  allSelected: boolean
  selectedKeys: Set<string>
  onToggleSelectAll: () => void
  onToggleFileKey: (path: string) => void
  onEnterDir: (item: S3FileItem) => void
  onGoAddDataSource: () => void
}

export function DataSourceTab({
  isLoading, dataSources, selectedDsId, onSelectDs, browsePrefix, showBack, onBrowseBack,
  isBrowsing, browseFiles, fileCount, allSelected, selectedKeys,
  onToggleSelectAll, onToggleFileKey, onEnterDir, onGoAddDataSource,
}: DataSourceTabProps) {
  const t = useTranslations("DocImport")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t("loading")}
      </div>
    )
  }

  if (dataSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300">
          <Database className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">{t("noSourcesTitle")}</p>
          <p className="text-xs text-slate-500 max-w-sm">{t("noSourcesDesc")}</p>
        </div>
        <Button size="sm" onClick={onGoAddDataSource} className="gap-1.5 mt-1">
          <Plus className="h-3.5 w-3.5" />
          {t("goConfigureSource")}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>{t("selectSource")}</Label>
        <Select
          value={selectedDsId?.toString() ?? ""}
          onValueChange={v => onSelectDs(Number(v))}
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
          {showBack && (
            <Button variant="ghost" size="sm" onClick={onBrowseBack} className="h-7 px-2 text-xs gap-1">
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
                    onClick={onToggleSelectAll}
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
                    onClick={() => item.type === "dir" ? onEnterDir(item) : onToggleFileKey(item.path)}
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
  )
}
