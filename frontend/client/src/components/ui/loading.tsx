import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  /** 大小 */
  size?: "sm" | "md" | "lg"
  /** 加载文本 */
  text?: string
  /** 是否全屏居中 */
  fullScreen?: boolean
  /** 自定义类名 */
  className?: string
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-12 w-12",
  lg: "h-16 w-16",
}

/**
 * 加载中 Spinner 组件
 */
export function LoadingSpinner({ 
  size = "md", 
  text, 
  fullScreen = false,
  className 
}: LoadingSpinnerProps) {
  const content = (
    <div className={cn("text-center", className)}>
      <div 
        className={cn(
          "animate-spin rounded-full border-b-2 border-primary mx-auto mb-4",
          sizeClasses[size]
        )} 
      />
      {text && (
        <p className="text-slate-400">{text}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        {content}
      </div>
    )
  }

  return content
}

/**
 * 页面加载组件（全屏）
 */
export function PageLoading({ text = "正在加载..." }: { text?: string }) {
  return <LoadingSpinner size="md" text={text} fullScreen />
}

/**
 * 内联加载组件
 */
export function InlineLoading({ text }: { text?: string }) {
  return <LoadingSpinner size="sm" text={text} />
}

