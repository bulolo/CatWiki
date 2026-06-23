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
import { Folder, FolderInput, Loader2 } from "lucide-react"
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import type { CollectionTree as APICollectionTree } from "@/lib/sdk/sdk.schemas"
import { cn } from "@/lib/utils"

interface BatchMoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 选中待移动的文档数 */
  count: number
  /** 扁平化（带 level 缩进）的目标合集列表 */
  flatCollections: (APICollectionTree & { level: number })[]
  value: string
  onValueChange: (value: string) => void
  onConfirm: () => void
  isPending: boolean
}

/** 批量移动文档到目标合集的弹窗。由 documents/page.tsx 内联实现抽出，行为一致。 */
export function BatchMoveDialog({
  open,
  onOpenChange,
  count,
  flatCollections,
  value,
  onValueChange,
  onConfirm,
  isPending,
}: BatchMoveDialogProps) {
  const t = useTranslations("Documents")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FolderInput className="h-5 w-5 text-slate-900" />
            {t("dialogs.batchMove.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dialogs.batchMove.description", { count })}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-3">
            <Select value={value} onValueChange={onValueChange}>
              <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all">
                <SelectValue placeholder={t("dialogs.batchMove.placeholderTarget")} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] rounded-xl border-slate-200 shadow-xl">
                {flatCollections.map((col) => (
                  <SelectItem
                    key={col.id}
                    value={col.id.toString()}
                    className="py-2.5 rounded-lg focus:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {col.level > 0 && (
                        <span className="text-slate-300 select-none">
                          {"　".repeat(col.level)}
                        </span>
                      )}
                      <Folder className={cn(
                        "h-3.5 w-3.5",
                        col.level === 0 ? "text-primary/60" : "text-slate-400"
                      )} />
                      <span className={cn(
                        "font-medium",
                        col.level === 0 ? "text-slate-900" : "text-slate-600"
                      )}>
                        {col.title}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg h-9"
          >
            {t("dialogs.batchMove.cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!value || isPending}
            className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg h-9 px-6 flex items-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? t("dialogs.batchMove.moving") : t("dialogs.batchMove.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
