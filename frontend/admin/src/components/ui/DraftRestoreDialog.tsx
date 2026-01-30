"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Trash2, Clock } from "lucide-react"

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
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">发现未保存的草稿</DialogTitle>
              <DialogDescription className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                <span>保存于 {savedTimeAgo}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-slate-600">
            检测到您有未完成的编辑内容，是否恢复？
          </p>
        </div>

        <DialogFooter className="sm:space-x-2">
          <Button
            variant="outline"
            onClick={onDiscard}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            丢弃草稿
          </Button>
          <Button
            onClick={onRestore}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            恢复草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}






