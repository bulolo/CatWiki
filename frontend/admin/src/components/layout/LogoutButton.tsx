"use client"

import { LogOut } from "lucide-react"
import { logout } from "@/lib/auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LogoutButtonProps {
  className?: string
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      toast.success('已退出登录')
      logout()
    }
  }

  return (
    <button 
      onClick={handleLogout}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group",
        className
      )}
    >
      <div className="p-1.5 rounded-lg bg-slate-200/50 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
        <LogOut className="h-4 w-4" />
      </div>
      <span className="text-sm font-semibold">退出登录</span>
    </button>
  )
}

