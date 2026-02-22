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

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion, Home, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface NotFoundStateProps {
  title?: string
  description?: string
  showHome?: boolean
  showBack?: boolean
  className?: string
}

/**
 * 404 / 不存在状态展示组件
 */
export function NotFoundState({
  title = "页面不存在",
  description = "抱歉，您访问的页面不存在或已被移除。",
  showHome = true,
  showBack = false,
  className
}: NotFoundStateProps) {
  return (
    <div className={cn(
      "min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500",
      className
    )}>
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-24 h-24 md:w-32 md:h-32 bg-white rounded-3xl md:rounded-[40px] shadow-2xl flex items-center justify-center border border-slate-100/50">
          <FileQuestion className="w-12 h-12 md:w-16 md:h-16 text-primary" />
        </div>
      </div>

      <div className="max-w-md space-y-3">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>
        <p className="text-slate-500 text-sm md:text-base leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-10">
        {showBack && (
          <Button 
            variant="outline" 
            size="lg" 
            className="rounded-xl h-12 px-8 min-w-[160px] border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回上一页
          </Button>
        )}
        
        {showHome && (
          <Link href="/">
            <Button 
              size="lg" 
              className="rounded-xl h-12 px-8 min-w-[160px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold"
            >
              <Home className="mr-2 h-4 w-4" />
              回到首页
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
