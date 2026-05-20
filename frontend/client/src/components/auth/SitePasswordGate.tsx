"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react"
import { verifySitePassword } from '@/lib/sdk/ee-client-sites'

interface SitePasswordGateProps {
  siteSlug: string
  siteName?: string
  hasPassword: boolean
  onVerified: () => void
}

export function SitePasswordGate({ siteSlug, siteName, hasPassword, onVerified }: SitePasswordGateProps) {
  const t = useTranslations("SlugPage")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError("")

    try {
      const result = await verifySitePassword(siteSlug, { password })
      if (result?.access_token) {
        sessionStorage.setItem(`site_access_token:${siteSlug}`, result.access_token)
        onVerified()
      } else {
        setError(t("passwordError"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("passwordError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-slate-600" />
            </div>
            {siteName && (
              <h2 className="text-lg font-bold text-slate-900 mb-1">{siteName}</h2>
            )}
            <p className="text-sm text-slate-500 text-center">
              {hasPassword ? t("passwordRequired") : t("siteNotPublic")}
            </p>
          </div>

          {hasPassword && (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 focus:bg-white"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("passwordVerifying")}
                  </>
                ) : (
                  t("passwordSubmit")
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
