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

import { useTranslations, useLocale } from "next-intl"
import { logger } from "@/lib/logger"
import { MdEditor } from "md-editor-rt"
import "md-editor-rt/lib/style.css"
import styles from "./MarkdownEditor.module.css"
import { toast } from "sonner"
import { uploadAdminFile } from "@/lib/sdk/admin-files"
import { toUploadedFileInfo } from "@/lib/normalizers"

import imageCompression from "browser-image-compression"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Markdown 编辑器组件
 * 封装 md-editor-rt，用于懒加载
 * 
 * 通过 next/dynamic 懒加载此组件，可以将编辑器代码从主 bundle 中分离
 */
export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const t = useTranslations("Editor")
  const locale = useLocale()

  /**
   * 处理图片上传
   * @param files 上传的文件数组
   * @param callback 回调函数，返回图片 URL 数组
   */
  const handleUploadImage = async (files: File[], callback: (urls: string[]) => void) => {
    try {
      const uploadedUrls: string[] = []

      for (const file of files) {
        // 验证文件类型
        if (!file.type.startsWith("image/")) {
          toast.error(t("notImageFile", { name: file.name }))
          continue
        }

        // 验证文件大小（原始大小不超过 10MB）
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t("fileTooLarge", { name: file.name }))
          continue
        }

        try {
          // 压缩图片
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8,
          })

          // 确保压缩后的文件保留原始文件名和扩展名
          const fileToUpload = new File(
            [compressedFile],
            file.name,
            { type: compressedFile.type }
          )

          // 上传图片
          const rawResp = await uploadAdminFile({ file: fileToUpload })
          const uploadRes = toUploadedFileInfo(rawResp)
          if (!uploadRes.url) {
            throw new Error(t("uploadMissingUrl"))
          }

          const imageUrl = uploadRes.url
          uploadedUrls.push(imageUrl)
          logger.debug("图片上传成功:", {
            originalName: file.name,
            url: imageUrl,
            size: uploadRes.size
          })
          toast.success(t("uploadSuccess", { name: file.name }))

        } catch (error) {
          toast.error(t("uploadFailed", { name: file.name }))
        }
      }

      // 调用回调函数，传入上传成功的 URL 数组
      callback(uploadedUrls)
    } catch (error) {
      toast.error(t("imageUploadFailed"))
      callback([])
    }
  }

  return (
    <div className={`md-editor-wrapper w-full border rounded-lg overflow-hidden ${styles.editorWrapper}`}>
      <MdEditor
        modelValue={value}

        onChange={onChange}
        language={locale === "zh" ? "zh-CN" : "en"}
        placeholder={placeholder || t("placeholder")}
        toolbarsExclude={["github"]}
        showCodeRowNumber
        previewTheme="github"
        onUploadImg={handleUploadImage}
        style={{ height: "calc(100vh - 350px)", border: "none" }}
      />
    </div>
  )
}
