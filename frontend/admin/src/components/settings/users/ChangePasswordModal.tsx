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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Eye, EyeOff, Shield, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateAdminUserPassword } from '@/lib/sdk/admin-users'
import { getUserInfo } from "@/lib/auth"
import { logError } from "@/lib/error-handler"

import { useTranslations } from "next-intl"

interface ChangePasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const t = useTranslations("ChangePassword")
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t("errorFillAll"))
      return
    }

    if (newPassword.length < 6) {
      toast.error(t("errorMinLength"))
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("errorMismatch"))
      return
    }

    if (oldPassword === newPassword) {
      toast.error(t("errorSameAsOld"))
      return
    }

    setLoading(true)

    try {
      const user = getUserInfo()
      if (!user) {
        toast.error(t("errorNoUser"))
        return
      }

      await updateAdminUserPassword(user.id, {
        old_password: oldPassword,
        new_password: newPassword,
      })

      toast.success(t("success"))

      // 重置并关闭
      handleClose()
    } catch (error: unknown) {
      logError(t("title"), error)
      toast.error(error instanceof Error ? error.message : t("failed"))
    } finally {

      setLoading(false)
    }
  }

  const handleClose = () => {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">{t("currentPassword")}</Label>
            <div className="relative">
              <Input
                id="old-password"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t("placeholderCurrent")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("placeholderNew")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("placeholderConfirm")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-3">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-[11px] text-blue-700 leading-relaxed">
              {t("securityTip")}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleChangePassword}
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t("updating") : t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
