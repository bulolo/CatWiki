"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Settings,
  LogOut,
  Shield,
  ChevronDown,
  Lock
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getUserInfo, logout } from "@/lib/auth"
import { UserRole } from "@/lib/api-client"
import { toast } from "sonner"
import { ChangePasswordModal } from "@/components/settings/ChangePasswordModal"

export function UserMenu() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const user = mounted ? getUserInfo() : null

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      toast.success('已退出登录')
      logout()
    }
  }

  // 获取显示的名称
  const displayName = user?.name || "管理员"
  const initials = displayName.substring(0, 2).toUpperCase()

  // 获取显示的职业/角色
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return '系统管理员'
      case UserRole.SITE_ADMIN:
        return '站点管理员'
      case UserRole.EDITOR:
        return '站点编辑'
      default:
        return '普通用户'
    }
  }

  const roleLabel = getRoleLabel(user?.role)

  if (!mounted) {
    return (
      <div className="flex items-center gap-2.5 p-1 rounded-full border border-transparent">
        <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
        <ChevronDown className="h-3.5 w-3.5 text-slate-200" />
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-50 transition-all outline-none group border border-transparent hover:border-slate-100">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/30 group-hover:bg-white">
            <span className="text-xs font-bold text-slate-500 group-hover:text-primary">{initials}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl border-slate-200 shadow-lg mt-1 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="px-3 py-2.5 mb-1 pb-2 border-b border-slate-50">
            <p className="text-sm font-bold text-slate-800 tracking-tight">{displayName}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-widest mt-0.5">{roleLabel}</p>
          </div>

          <DropdownMenuItem
            className="rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer focus:bg-slate-50 transition-colors font-medium text-slate-600 focus:text-primary"
            onSelect={() => setShowPasswordModal(true)}
          >
            <Lock className="h-4 w-4 opacity-70" />
            <span className="text-sm">修改密码</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-slate-50" />

          <DropdownMenuItem
            className="rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer text-red-500 focus:bg-red-50 focus:text-red-600 transition-colors font-medium"
            onSelect={handleLogout}
          >
            <LogOut className="h-4 w-4 opacity-70" />
            <span className="text-sm">退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordModal
        open={showPasswordModal}
        onOpenChange={setShowPasswordModal}
      />
    </>
  )
}
