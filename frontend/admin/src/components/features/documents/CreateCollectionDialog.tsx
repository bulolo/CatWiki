"use client"

import { useState } from "react"
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
import type { CollectionTree } from "@/lib/api-client"

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
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("root")

  const createCollectionMutation = useCreateCollection(siteId)

  const handleCreate = () => {
    if (!name.trim()) return

    createCollectionMutation.mutate({
      site_id: siteId,
      title: name.trim(),
      parent_id: parentId === "root" ? undefined : parseInt(parentId)
    } as any, {
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
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>创建新合集</DialogTitle>
          <DialogDescription>
            为您的文档创建一个新的合集，用于分类管理。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">合集名称</label>
            <Input
              placeholder="例如：入门指南、API 文档..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">父级合集（可选）</label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="rounded-xl border-slate-200">
                <SelectValue placeholder="选择父级合集" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="root">无（根级别）</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-200">
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createCollectionMutation.isPending}
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            {createCollectionMutation.isPending ? "创建中..." : "创建合集"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
