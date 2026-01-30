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
import { Lock, Eye, EyeOff, Shield } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { getUserInfo } from "@/lib/auth"
import { logError } from "@/lib/error-handler"

interface ChangePasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有字段")
      return
    }

    if (newPassword.length < 6) {
      toast.error("新密码至少需要6位")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }

    if (oldPassword === newPassword) {
      toast.error("新密码不能与旧密码相同")
      return
    }

    setLoading(true)

    try {
      const user = getUserInfo()
      if (!user) {
        toast.error("未找到用户信息，请重新登录")
        return
      }

      await api.user.updatePassword(user.id, {
        old_password: oldPassword,
        new_password: newPassword,
      })

      toast.success("密码修改成功！")

      // 重置并关闭
      handleClose()
    } catch (error: any) {
      logError("修改密码", error)
      toast.error(error.message || "密码修改失败")
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
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            修改密码
          </DialogTitle>
          <DialogDescription>
            请输入当前密码及新密码以更新账户安全设置。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">当前密码</Label>
            <div className="relative">
              <Input
                id="old-password"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="当前密码"
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
            <Label htmlFor="new-password">新密码</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位字符"
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
            <Label htmlFor="confirm-password">确认新密码</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
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
              建议使用大写字母、小写字母、数字及符号的组合以提高安全性。
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleChangePassword}
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
          >
            {loading ? "修改中..." : "确认修改"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
