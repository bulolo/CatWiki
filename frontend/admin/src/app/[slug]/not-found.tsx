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

import Link from "next/link"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"
import { AlertCircle, Home, Search } from "lucide-react"
import { getTranslations } from "next-intl/server"

export default async function SiteNotFound() {
  const t = await getTranslations("SiteNotFound")
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50/50">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">{t("reasons")}</p>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>{t("reason1")}</li>
              <li>{t("reason2")}</li>
              <li>{t("reason3")}</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/" className="w-full">
              <Button className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                {t("backHome")}
              </Button>
            </Link>

            <Link href="/sites" className="w-full">
              <Button variant="outline" className="w-full" size="lg">
                <Search className="mr-2 h-4 w-4" />
                {t("viewAllSites")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
