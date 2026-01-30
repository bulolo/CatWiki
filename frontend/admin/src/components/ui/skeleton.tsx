import { cn } from "@/lib/utils"

/**
 * 骨架屏基础组件
 * 
 * 特性：
 * - 脉冲动画
 * - 灵活尺寸
 * - 可组合
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-100", className)}
      {...props}
    />
  )
}

export { Skeleton }



