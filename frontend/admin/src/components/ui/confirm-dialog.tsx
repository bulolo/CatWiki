// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

/**
 * ConfirmDialog 自实现 Dialog（不复用通用 DialogContent）以保证 z-index 比
 * 业务侧自写遮罩（如 PlatformModal 的 z-[100]）更高，避免被遮挡。
 */

export interface ConfirmOptions {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("ConfirmDialog")
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const handleResolve = useCallback((result: boolean) => {
    if (pending) {
      pending.resolve(result)
      setPending(null)
    }
  }, [pending])

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root
        open={pending !== null}
        onOpenChange={(open) => { if (!open) handleResolve(false) }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-[300] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[300] w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-modal border bg-background p-6 shadow-modal gap-4 grid duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2"
          >
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              {pending?.title ?? t("defaultTitle")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {pending?.description}
            </DialogPrimitive.Description>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2">
              <Button variant="outline" onClick={() => handleResolve(false)}>
                {pending?.cancelText ?? t("cancel")}
              </Button>
              <Button
                variant={pending?.variant === "destructive" ? "destructive" : "default"}
                onClick={() => handleResolve(true)}
              >
                {pending?.confirmText ?? t("confirm")}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx.confirm
}
