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
import { logger } from "@/lib/logger"
import { useTranslations } from 'next-intl'
import { ImageIcon, Loader2, Camera, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { uploadAdminFile } from '@/lib/sdk/admin-files'
import { toUploadedFileInfo } from "@/lib/normalizers"
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
  text,
  compact = false
}: ImageUploadProps) {
  const t = useTranslations('ImageUpload')
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

      const info = t("compressInfo", { ratio: compressionRatio, saved: savedSize })
      setCompressionInfo(info)

      if (process.env.NODE_ENV === 'development') {
        logger.debug('图片压缩完成:', {
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
      toast.error(t("invalidType"))
      return
    }

    // 验证文件大小（最大 10MB，因为会自动压缩）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t("tooLarge"))
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
        toast.info(t("compressing"))
        fileToUpload = await compressImage(file)
        toast.success(t("compressSuccess", { info: compressionInfo }))
      }

      setIsUploading(true)

      // 上传文件
      const rawResp = await uploadAdminFile(
        { file: fileToUpload },
        { folder: 'covers' }, // 封面图专用文件夹
      )
      const uploadedData = toUploadedFileInfo(rawResp)
      const uploadedUrl = uploadedData.url || uploadedData.object_name
      if (!uploadedUrl) {
        throw new Error(t("uploadMissingUrl"))
      }
      onChange(uploadedUrl)
      toast.success(t("uploadSuccess"))

      // 释放本地预览 URL
      if (localPreview) {
        URL.revokeObjectURL(localPreview)
      }
      setPreviewUrl(uploadedUrl)

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.warn('图片上传失败:', errorMessage)
      }
      toast.error(error instanceof Error ? error.message : t("uploadFailed"))
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
    toast.success(t("removed"))
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
        // 预览模式 - 精美重构
        <div className="relative group w-full h-full">
          <div className={cn(
            aspect,
            "rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 transition-all duration-500",
            "group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5"
          )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={t("preview")}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </div>

          {/* 玻璃拟态遮罩 */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl overflow-hidden pointer-events-none group-hover:pointer-events-auto"
            >
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-all duration-300" />

              <div className="relative z-20 flex gap-2">
                {/* 更换按钮 - 悬浮圆球设计 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={handleClick}
                  disabled={disabled || isProcessing}
                  className="w-10 h-10 rounded-full bg-white/95 text-slate-700 shadow-xl flex items-center justify-center hover:bg-white hover:text-primary transition-colors disabled:opacity-50"
                  title={t("changeImage")}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </motion.button>

                {/* 删除按钮 - 悬浮圆球设计 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || isProcessing}
                  className="w-10 h-10 rounded-full bg-red-500 text-white shadow-xl flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
                  title={t("removeImage")}
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>

              {/* 底部微提示 */}
              {!compact && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  whileHover={{ y: 0, opacity: 1 }}
                  className="absolute bottom-4 text-white/90 text-[10px] font-bold tracking-widest uppercase"
                >
                  {t("editImage")}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
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
                {isCompressing ? t("compressingState") : t("uploadingState")}
              </span>
              {isCompressing && (
                <span className="text-[10px] text-slate-400">
                  {t("compressHint")}
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
                  {text ?? t("defaultText")}
                </span>
                {!compact && (
                  <>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {t("formatHint")}
                    </span>
                    <span className="text-[9px] text-slate-300 mt-0.5 block">
                      {t("autoCompress")}
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
