import { Skeleton } from "./skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

/**
 * 表格骨架屏
 * 
 * 用于文档列表、用户列表等表格加载状态
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 5,
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <Table>
      {showHeader && (
        <TableHeader className="bg-slate-50/50">
          <TableRow className="hover:bg-transparent border-b border-slate-100">
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i} className="py-3">
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex} className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex} className="py-3">
                {colIndex === 0 ? (
                  // 第一列：图片 + 文字
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ) : colIndex === columns - 1 ? (
                  // 最后一列：操作按钮
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ) : (
                  // 其他列：文字
                  <Skeleton className="h-4 w-24" />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * 文档列表专用骨架屏
 */
export function DocumentTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
        <TableRow className="hover:bg-transparent border-b border-slate-100">
          <TableHead className="w-[50px] py-3">
            <Skeleton className="h-3 w-4" />
          </TableHead>
          <TableHead className="w-[300px]">
            <Skeleton className="h-3 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-3 w-12" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-3 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-3 w-20" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-3 w-16" />
          </TableHead>
          <TableHead className="text-right">
            <Skeleton className="h-3 w-12 ml-auto" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            {/* 序号 */}
            <TableCell className="py-3 pl-6">
              <Skeleton className="h-4 w-6" />
            </TableCell>
            {/* 封面 + 标题 */}
            <TableCell className="py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </TableCell>
            {/* 标签 */}
            <TableCell className="py-3">
              <div className="flex gap-1">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </TableCell>
            {/* 状态 */}
            <TableCell className="py-3">
              <Skeleton className="h-5 w-14 rounded-full" />
            </TableCell>
            {/* 合集 */}
            <TableCell className="py-3">
              <Skeleton className="h-4 w-20" />
            </TableCell>
            {/* 更新时间 */}
            <TableCell className="py-3">
              <Skeleton className="h-3 w-28" />
            </TableCell>
            {/* 操作 */}
            <TableCell className="py-3 pr-6">
              <div className="flex justify-end gap-2">
                <Skeleton className="h-7 w-7 rounded" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

