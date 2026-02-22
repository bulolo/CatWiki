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

"use client"

import { useState, useRef, useEffect } from "react"
import { ImageIcon, X, Upload, Loader2 } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  className?: string
  aspect?: string
  text?: string
  compact?: boolean
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  className,
  aspect = "aspect-[16/10]",
  text = "点击上传封面图",
  compact = false
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const [compressionInfo, setCompressionInfo] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 当外部 value 变化时，更新 previewUrl（用于回显已有图片）
  useEffect(() => {
    setPreviewUrl(value || null)
  }, [value])

  /**
   * 压缩图片
   * @param file 原始图片文件
   * @returns 压缩后的文件
   */
  const compressImage = async (file: File): Promise<File> => {
    const originalSize = file.size

    // 压缩配置
    const options = {
      maxSizeMB: 1, // 最大 1MB
      maxWidthOrHeight: 1920, // 最大宽度或高度
      useWebWorker: true, // 使用 Web Worker 提高性能
      fileType: file.type, // 保持原始格式
      initialQuality: 0.8, // 初始质量
    }

    try {
      setIsCompressing(true)
      const compressedFile = await imageCompression(file, options)
      const compressedSize = compressedFile.size

      // 计算压缩率
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      const savedSize = ((originalSize - compressedSize) / 1024 / 1024).toFixed(2)

      const info = `压缩 ${compressionRatio}%，节省 ${savedSize} MB`
      setCompressionInfo(info)

      if (process.env.NODE_ENV === 'development') {
        console.log('📦 图片压缩完成:', {
          原始大小: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
          压缩后: `${(compressedSize / 1024 / 1024).toFixed(2)} MB`,
          压缩率: `${compressionRatio}%`
        })
      }

      return compressedFile
    } finally {
      setIsCompressing(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }

    // 验证文件大小（最大 10MB，因为会自动压缩）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('图片大小不能超过 10MB')
      return
    }

    let localPreview: string | null = null

    try {
      // 创建本地预览
      localPreview = URL.createObjectURL(file)
      setPreviewUrl(localPreview)

      // 压缩图片（如果图片大于 1MB）
      let fileToUpload = file
      if (file.size > 1024 * 1024) {
        toast.info('正在智能压缩图片...')
        fileToUpload = await compressImage(file)
        toast.success(`压缩完成！${compressionInfo}`)
      }

      setIsUploading(true)

      // 上传文件
      const uploadedData = await api.file.uploadFile({
        formData: { file: fileToUpload },
        folder: 'covers' // 封面图专用文件夹
      }) as any

      const uploadedUrl = uploadedData.url || uploadedData.object_name
      onChange(uploadedUrl)
      toast.success('图片上传成功')

      // 释放本地预览 URL
      if (localPreview) {
        URL.revokeObjectURL(localPreview)
      }
      setPreviewUrl(uploadedUrl)

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn('图片上传失败:', errorMessage)
      }
      toast.error(error instanceof Error ? error.message : '图片上传失败')
      setPreviewUrl(value || null)

      // 清理预览 URL
      if (localPreview) {
        URL.revokeObjectURL(localPreview)
      }
    } finally {
      setIsUploading(false)
      setCompressionInfo('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    toast.success('图片已移除')
  }

  const handleClick = () => {
    if (!disabled && !isUploading && !isCompressing) {
      fileInputRef.current?.click()
    }
  }

  const isProcessing = isUploading || isCompressing

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
        className="hidden"
      />

      {previewUrl ? (
        // 预览模式
        <div className="relative group">
          <div className={cn(aspect, "rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200 transition-all group-hover:border-primary/30")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="封面预览"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          {/* 悬停遮罩 - 优雅的渐变效果 */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl flex flex-col items-center justify-end gap-3",
            compact ? "pb-2" : "pb-6"
          )}>
            <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-3")}>
              {/* 更换图片按钮 */}
              <button
                type="button"
                onClick={handleClick}
                disabled={disabled || isProcessing}
                className={cn(
                  "flex items-center justify-center bg-white/95 hover:bg-white text-slate-700 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed",
                  compact ? "w-8 h-8" : "px-4 py-2.5 text-sm"
                )}
                title="更换图片"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {!compact && <span className="ml-2">更换图片</span>}
                  </>
                )}
              </button>

              {/* 删除按钮 */}
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isProcessing}
                className={cn(
                  "flex items-center justify-center bg-red-500/90 hover:bg-red-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed",
                  compact ? "w-8 h-8" : "w-10 h-10"
                )}
                title="移除图片"
              >
                <X className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
              </button>
            </div>

            {/* 提示文字 */}
            {!compact && <span className="text-white/90 text-[10px] font-medium">点击更换或删除</span>}
          </div>
        </div>
      ) : (
        // 上传模式
        <div
          onClick={handleClick}
          className={cn(
            aspect, "border-2 border-dashed border-slate-200 rounded-xl",
            "flex flex-col items-center justify-center",
            compact ? "gap-1.5 p-2" : "gap-3 p-4",
            "hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group",
            "bg-slate-50/30",
            (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <>
              <div className={cn("bg-white rounded-full shadow-sm", compact ? "p-1.5" : "p-3")}>
                <Loader2 className={cn("text-primary animate-spin", compact ? "h-4 w-4" : "h-6 w-6")} />
              </div>
              <span className="text-[10px] font-semibold text-slate-500">
                {isCompressing ? '压缩中...' : '上传中...'}
              </span>
              {isCompressing && (
                <span className="text-[10px] text-slate-400">
                  优化图片质量，请稍候
                </span>
              )}
            </>
          ) : (
            <>
              <div className={cn("bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform duration-300", compact ? "p-1.5" : "p-3")}>
                <ImageIcon className={cn("text-slate-300 group-hover:text-primary transition-colors", compact ? "h-4 w-4" : "h-6 w-6")} />
              </div>
              <div className="text-center">
                <span className={cn(
                  "font-semibold text-slate-400 group-hover:text-primary transition-colors block px-2",
                  compact ? "text-[10px]" : "text-[11px]"
                )}>
                  {text}
                </span>
                {!compact && (
                  <>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      支持 JPG、PNG、WebP，最大 10MB
                    </span>
                    <span className="text-[9px] text-slate-300 mt-0.5 block">
                      📦 自动智能压缩，节省存储空间
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

