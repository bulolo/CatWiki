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
