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

import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  imageSrc?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  imageSrc
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in-50 duration-500",
      className
    )}>
      <div className="bg-slate-50 p-4 rounded-full mb-4 ring-1 ring-slate-100 flex items-center justify-center">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={title} className="w-12 h-12 opacity-80" />
        ) : Icon ? (
          <Icon className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
        ) : null}
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-1 tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-slate-500 max-w-[300px] leading-relaxed mb-6">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
