"use client"

import { Card, CardContent } from "@/components/ui/card"

/**
 * 编辑器加载骨架屏
 */
export function EditorSkeleton() {
  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-hidden bg-background">
          {/* 工具栏骨架 */}
          <div className="border-b bg-muted/30 p-2 flex gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-8 bg-muted rounded animate-pulse"
              />
            ))}
          </div>
          
          {/* 编辑器内容区域骨架 */}
          <div className="grid grid-cols-2 divide-x min-h-[500px]">
            {/* 编辑区 */}
            <div className="p-4 space-y-3">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              <div className="mt-6 h-4 bg-muted rounded animate-pulse w-4/5" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </div>
            
            {/* 预览区 */}
            <div className="p-4 bg-muted/10 space-y-3">
              <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="mt-4 h-4 bg-muted rounded animate-pulse w-2/3" />
            </div>
          </div>
          
          {/* 底部状态栏骨架 */}
          <div className="border-t bg-muted/30 p-2 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

