'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 在生产环境中，可以发送到错误监控服务
    console.error('应用错误:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">出错了</h2>
        <p className="text-slate-600 mb-4">
          {error.message || '页面加载时发生错误'}
        </p>
        <Button onClick={reset}>重新尝试</Button>
      </div>
    </div>
  )
}







