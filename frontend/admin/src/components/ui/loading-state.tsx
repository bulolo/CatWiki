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
