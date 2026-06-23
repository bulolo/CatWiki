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

import { type ChangeEvent, type RefObject } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui"
import { Trash2, Loader2, X, FolderOpen, Folder, FileText, ChevronRight, ArrowLeft, RefreshCw, Upload } from "lucide-react"
import type { S3FileItem } from "@/lib/sdk/sdk.schemas"
import { formatSize } from "@/lib/utils"

interface DataSourceBrowserProps {
  browsePrefix: string
  showBack: boolean
  isBrowsing: boolean
  browseFiles: S3FileItem[]
  isUploading: boolean
  deletingKey: string | null | undefined
  uploadInputRef: RefObject<HTMLInputElement | null>
  onBack: () => void
  onUploadClick: () => void
  onFilePicked: (e: ChangeEvent<HTMLInputElement>) => void
  onRefresh: () => void
  onClose: () => void
  onEnterDir: (item: S3FileItem) => void
  onDeleteFile: (item: S3FileItem) => void
}

export function DataSourceBrowser({
  browsePrefix, showBack, isBrowsing, browseFiles, isUploading, deletingKey, uploadInputRef,
  onBack, onUploadClick, onFilePicked, onRefresh, onClose, onEnterDir, onDeleteFile,
}: DataSourceBrowserProps) {
  const t = useTranslations("DataSources")
  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-slate-50/60 border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0 flex-1">
          <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-mono truncate">{browsePrefix || "/"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 text-xs gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("back")}
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={onUploadClick}
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
            onChange={onFilePicked}
          />
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isBrowsing}
            title={t("refresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isBrowsing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7"
            onClick={onClose}
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
                onClick={() => item.type === "dir" && onEnterDir(item)}
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
                      onClick={(e) => { e.stopPropagation(); onDeleteFile(item) }}
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
}
