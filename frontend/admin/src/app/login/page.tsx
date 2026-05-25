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
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui"
import { ShieldCheck, ArrowRight, Info, Eye, EyeOff } from "lucide-react"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { toast } from "sonner"
import { login as authLogin } from "@/lib/auth"
import { useLogin } from "@/hooks"

export default function LoginPage() {
  const t = useTranslations("Login")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // 获取 redirect 参数
  const redirectPath = searchParams.get("redirect") || "/"

  // 使用 React Query 登录 hook
  const loginMutation = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 基本验证
    if (!email.trim()) {
      toast.error(t("errorEmail"))
      return
    }

    if (!password.trim()) {
      toast.error(t("errorPassword"))
      return
    }

    loginMutation.mutate({
      email,
      password
    }, {
      onSuccess: (data) => {
        if (!data) return
        const { token, user } = data

        // 使用统一的登录函数保存认证状态
        authLogin(token, user, true) // remember = true

        toast.success(t("welcomeBack", { name: user.name }))

        // 跳转到 redirect 参数指定的页面，如果没有则跳转到首页
        setTimeout(() => {
          router.push(redirectPath)
          router.refresh()
        }, 500)
      }
    })
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      {/* 语言切换 */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("welcome")}
          </p>
        </div>

        {/* 登录表单 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">{t("heading")}</CardTitle>
            <CardDescription className="text-center">
              {t("description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">{t("password")}</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => toast.info(t("forgotPasswordTip"))}
                  >
                    {t("forgotPassword")}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    <span>{t("submitting")}</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>{t("submit")}</span>
                  </>
                )}
              </Button>
            </form>

            {/* 提示信息 */}
            <button
              type="button"
              className="mt-6 w-full p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors text-left cursor-pointer"
              onClick={() => { setEmail("admin@catwiki.cn"); setPassword("admin123") }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Info className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground">{t("demoAccount")}</p>
                  <p className="text-foreground font-mono mt-0.5">admin@catwiki.cn / admin123</p>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* 底部信息 */}
        <div className="text-center text-xs text-muted-foreground mt-6">
          <p>
            © 2026 <a href="https://catwiki.ai" target="_blank" className="hover:text-primary transition-colors">CatWiki</a> Team. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

