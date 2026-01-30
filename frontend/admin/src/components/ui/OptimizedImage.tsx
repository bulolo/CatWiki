"use client"

import Image from 'next/image'
import { useState } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  className?: string
  fallbackIcon?: React.ReactNode
  priority?: boolean
}

/**
 * 优化的图片组件
 * 
 * 特性：
 * - 使用 Next.js Image 组件（本地图片）或原生 img（外部图片）
 * - 支持 WebP/AVIF 格式
 * - 懒加载（默认）
 * - 错误回退
 */
export function OptimizedImage({
  src,
  alt,
  width = 40,
  height = 40,
  className,
  fallbackIcon,
  priority = false
}: OptimizedImageProps) {
  const [error, setError] = useState(false)
  
  // 如果没有图片或加载失败，显示回退图标
  if (!src || error) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-slate-100/50",
        className
      )}>
        {fallbackIcon || <FileText className="h-1/2 w-1/2 text-slate-300/70" />}
      </div>
    )
  }
  
  // 检查是否是外部 URL
  const isExternal = src.startsWith('http://') || src.startsWith('https://')
  
  // 对于外部图片（如从 MinIO/RustFS 加载的），暂时使用原生 img 标签
  // 因为 Next.js Image 需要额外配置且可能需要重启服务器
  if (isExternal) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          onError={() => setError(true)}
          style={{ objectFit: 'cover' }}
        />
      </div>
    )
  }
  
  // 对于本地图片，使用 Next.js Image 优化
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        onError={() => setError(true)}
        priority={priority}
        quality={80}
        sizes="(max-width: 768px) 40px, 40px"
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}

