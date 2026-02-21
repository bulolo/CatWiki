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

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  text?: string
  className?: string
  spinnerClassName?: string
}

export function LoadingState({
  text = "加载中...",
  className,
  spinnerClassName
}: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 gap-3", className)}>
      <div className="relative">
        <Loader2 className={cn("h-8 w-8 animate-spin text-primary opacity-80", spinnerClassName)} />
        <div className="absolute inset-0 h-8 w-8 rounded-full border-t border-primary/20 animate-ping opacity-20 duration-1000" />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          {text}
        </p>
      )}
    </div>
  )
}
