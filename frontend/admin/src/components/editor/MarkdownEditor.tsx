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

import { MdEditor } from 'md-editor-rt'
import 'md-editor-rt/lib/style.css'
import styles from './MarkdownEditor.module.css'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

import imageCompression from 'browser-image-compression'

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
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} 不是图片文件`)
          continue
        }

        // 验证文件大小（原始大小不超过 10MB）
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} 文件过大，请选择小于 10MB 的图片`)
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
          const uploadRes = await api.file.uploadFile({
            formData: {
              file: fileToUpload,
            },
          }) as any

          const imageUrl = uploadRes.url
          uploadedUrls.push(imageUrl)
          console.log('图片上传成功:', {
            originalName: file.name,
            url: imageUrl,
            size: uploadRes.size
          })
          toast.success(`${file.name} 上传成功`)

        } catch (error) {
          toast.error(`${file.name} 上传失败`)
        }
      }

      // 调用回调函数，传入上传成功的 URL 数组
      callback(uploadedUrls)
    } catch (error) {
      toast.error('图片上传失败')
      callback([])
    }
  }

  return (
    <div className={`md-editor-wrapper w-full border rounded-lg overflow-hidden ${styles.editorWrapper}`}>
      <MdEditor
        modelValue={value}

        onChange={onChange}
        language="zh-CN"
        placeholder={placeholder || "请输入文档内容（支持 Markdown 语法）\n\n💡 提示：\n- 可以直接粘贴图片\n- 可以拖拽图片到编辑器\n- 点击工具栏的图片按钮上传"}
        toolbarsExclude={['github']}
        showCodeRowNumber
        previewTheme="github"
        onUploadImg={handleUploadImage}
        style={{ height: 'calc(100vh - 350px)', border: 'none' }}
      />
    </div>
  )
}

