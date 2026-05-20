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

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateCollection } from "@/hooks"
import type { CollectionTree, CollectionCreate } from '@/lib/sdk/sdk.schemas'

interface CreateCollectionDialogProps {
  siteId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (collectionId: number) => void
  collections: (CollectionTree & { level?: number })[]
}

export function CreateCollectionDialog({
  siteId,
  open,
  onOpenChange,
  onSuccess,
  collections
}: CreateCollectionDialogProps) {
  const t = useTranslations("Documents")
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("root")

  const createCollectionMutation = useCreateCollection(siteId)

  const handleCreate = () => {
    if (!name.trim()) return

    const payload: CollectionCreate = {
      site_id: siteId,
      title: name.trim(),
      parent_id: parentId === "root" ? undefined : parseInt(parentId)
    }
    createCollectionMutation.mutate(payload, {
      onSuccess: (data) => {
        setName("")
        setParentId("root")
        onOpenChange(false)
        if (onSuccess && data?.id) {
          onSuccess(data.id)
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("dialogs.createCollection.title")}</DialogTitle>
          <DialogDescription>
            {t("dialogs.createCollection.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">{t("dialogs.createCollection.labelName")}</label>
            <Input
              placeholder={t("dialogs.createCollection.placeholderName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">{t("dialogs.createCollection.labelParent")}</label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="rounded-xl border-slate-200">
                <SelectValue placeholder={t("dialogs.createCollection.placeholderParent")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="root">{t("dialogs.createCollection.root")}</SelectItem>
                {collections.map(col => (
                  <SelectItem key={col.id} value={col.id.toString()}>
                    <span style={{ paddingLeft: `${(col.level || 0) * 12}px` }}>
                      {col.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("dialogs.createCollection.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createCollectionMutation.isPending}
            className="flex items-center gap-2"
          >
            {createCollectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {createCollectionMutation.isPending ? t("dialogs.createCollection.creating") : t("dialogs.createCollection.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
