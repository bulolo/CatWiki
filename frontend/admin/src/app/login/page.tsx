"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { login as authLogin } from "@/lib/auth"
import { useLogin } from "@/hooks"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  
  // 获取 redirect 参数
  const redirectPath = searchParams.get('redirect') || '/'
  
  // 使用 React Query 登录 hook
  const loginMutation = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 基本验证
    if (!email.trim()) {
      toast.error("请输入邮箱")
      return
    }
    
    if (!password.trim()) {
      toast.error("请输入密码")
      return
    }

    loginMutation.mutate({
      email,
      password
    }, {
      onSuccess: (data) => {
        const { token, user } = data
        
        // 使用统一的登录函数保存认证状态
        authLogin(token, user, true) // remember = true
        
        toast.success(`欢迎回来，${user.name}！`)
        
        // 跳转到 redirect 参数指定的页面，如果没有则跳转到首页
        setTimeout(() => {
          router.push(redirectPath)
          router.refresh()
        }, 500)
      }
    })
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        {/* Logo 和标题 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary shadow-xl shadow-primary/20 mb-6 group transition-transform hover:scale-105 duration-300">
            <LogIn className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-3">
            CatWiki 管理后台
          </h1>
          <p className="text-muted-foreground text-lg">
            欢迎回来，请登录您的账户
          </p>
        </div>

        {/* 登录表单 */}
        <Card className="shadow-2xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">管理员登录</CardTitle>
            <CardDescription className="text-center">
              请输入您的凭据以访问控制台
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold ml-1">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="h-12 bg-background/50 border-border focus:ring-primary/20 transition-all"
                  autoComplete="email"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" title="密码" className="text-sm font-semibold">密码</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => toast.info("请联系系统管理员重置密码")}
                  >
                    忘记密码？
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="h-12 pr-11 bg-background/50 border-border focus:ring-primary/20 transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    <span>安全验证中...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    <span>进入控制台</span>
                  </div>
                )}
              </Button>
            </form>

            {/* 提示信息 */}
            <div className="mt-8 p-4 bg-muted/50 rounded-2xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <LogIn className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground font-medium">默认测试账户</p>
                  <p className="text-foreground font-mono mt-0.5">admin@example.com / admin123</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 底部信息 */}
        <p className="text-center text-sm text-muted-foreground mt-8 font-medium">
          © 2025 CatWiki Team. All rights reserved.
        </p>
      </div>
    </div>
  )
}

