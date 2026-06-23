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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@/components/ui"
import { FileText, Trash2, Clock } from "lucide-react"
import { useTranslations } from "next-intl"

interface DraftRestoreDialogProps {
  open: boolean
  onRestore: () => void
  onDiscard: () => void
  savedTimeAgo: string
}

/**
 * 草稿恢复对话框组件
 */
export function DraftRestoreDialog({
  open,
  onRestore,
  onDiscard,
  savedTimeAgo
}: DraftRestoreDialogProps) {
  const t = useTranslations("DraftRestore")
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{t("title")}</DialogTitle>
              <DialogDescription className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                <span>{t("savedAt", { time: savedTimeAgo })}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-slate-600">
            {t("message")}
          </p>
        </div>

        <DialogFooter className="sm:space-x-2">
          <Button
            variant="outline"
            onClick={onDiscard}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {t("discard")}
          </Button>
          <Button
            onClick={onRestore}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t("restore")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}






