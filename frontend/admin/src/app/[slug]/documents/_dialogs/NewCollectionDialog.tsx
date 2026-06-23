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
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from "@/components/ui"

interface NewCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  onCreate: () => void
}

/**
 * documents 页内联的「新建合集」弹窗。
 *
 * 注意：与 components/features/documents/CreateCollectionDialog（带父级选择器）行为不同 ——
 * 本弹窗在当前上下文目标下创建，不暴露父级选择，故保留为独立组件而非复用那个。
 */
export function NewCollectionDialog({ open, onOpenChange, name, onNameChange, onCreate }: NewCollectionDialogProps) {
  const t = useTranslations("Documents")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("dialogs.createCollection.title")}</DialogTitle>
          <DialogDescription>
            {t("dialogs.createCollection.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t("dialogs.createCollection.labelName")}</label>
            <Input
              placeholder={t("dialogs.createCollection.placeholderName")}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("dialogs.createCollection.cancel")}</Button>
          <Button onClick={onCreate} disabled={!name.trim()}>{t("dialogs.createCollection.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
