import { Skeleton } from "./skeleton"
import { Card, CardContent, CardHeader } from "./card"

/**
 * 卡片骨架屏
 */
export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 统计卡片骨架屏
 */
export function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 文档卡片网格骨架屏（用于网格视图）
 */
export function DocumentCardSkeleton() {
  return (
    <Card className="group overflow-hidden">
      <CardContent className="p-0">
        {/* 封面图 */}
        <Skeleton className="w-full h-32" />
        {/* 内容 */}
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 文档卡片网格（多个）
 */
export function DocumentGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  )
}






