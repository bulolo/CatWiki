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

import { useEffect } from "react"
import { Button } from "@/components/ui"
import { useTranslations } from "next-intl"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("ErrorPage")
  useEffect(() => {
    // 在生产环境中，可以发送到错误监控服务
    console.error("应用错误:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50/50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">{t("title")}</h2>
        <p className="text-muted-foreground mb-4">
          {error.message || t("description")}
        </p>
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  )
}







