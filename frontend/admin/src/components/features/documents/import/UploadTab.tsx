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
import { Button } from "@/components/ui"
import { Upload, FileText, X } from "lucide-react"

interface UploadTabProps {
  files: File[]
  acceptTypes: string
  formatHint: string
  isSubmitting: boolean
  onAcceptFiles: (input: FileList | null) => void
  onRemoveFile: (idx: number) => void
}

export function UploadTab({ files, acceptTypes, formatHint, isSubmitting, onAcceptFiles, onRemoveFile }: UploadTabProps) {
  const t = useTranslations("DocImport")
  return (
    <>
      <div
        className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
          files.length > 0
            ? "border-primary/50 bg-primary/5"
            : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
        }`}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onAcceptFiles(e.dataTransfer.files) }}
        onClick={() => document.getElementById("doc-import-file-input")?.click()}
      >
        <input
          id="doc-import-file-input"
          type="file" className="hidden" accept={acceptTypes} multiple
          onChange={e => onAcceptFiles(e.target.files)}
        />
        <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-medium text-slate-600">{t("dropzone")}</p>
        <p className="text-sm text-slate-400 mt-1">{formatHint}</p>
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
                onClick={e => { e.stopPropagation(); onRemoveFile(index) }}
                disabled={isSubmitting}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
