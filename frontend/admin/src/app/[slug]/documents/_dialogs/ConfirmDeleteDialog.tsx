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
import { AlertCircle, Loader2 } from "lucide-react"
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui"
import { cn } from "@/lib/utils"

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  warning: string
  isPending: boolean
  onConfirm: () => void
  /** 删除合集弹窗的告警块带边框，其余不带 —— 保持原内联实现差异 */
  warningBordered?: boolean
}

/**
 * 通用「删除确认」弹窗。
 *
 * 替代 documents/page.tsx 中 3 个几乎逐字重复的删除确认弹窗（删除文档 / 批量删除 /
 * 删除合集）。取消 / 确认 / 删除中 文案三者一致，内部统一取；仅 标题 / 描述 / 告警 不同，
 * 由 props 传入。
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  warning,
  isPending,
  onConfirm,
  warningBordered = false,
}: ConfirmDeleteDialogProps) {
  const t = useTranslations("Documents")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription asChild className="pt-2 space-y-2">
            <div>
              <p>{description}</p>
              <p className={cn("text-red-500 bg-red-50 p-2 rounded text-xs", warningBordered && "border border-red-100")}>
                ⚠️ {warning}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("deleteDialog.cancel")}</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
