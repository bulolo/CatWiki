"use client"

import dynamic from 'next/dynamic'
import { EditorSkeleton } from './EditorSkeleton'

/**
 * 懒加载的 Markdown 编辑器
 * 
 * 使用 next/dynamic 懒加载编辑器组件，减少首屏 bundle 大小
 * 预期收益：减少约 300+ KB 的首屏 JS
 */
export const LazyMarkdownEditor = dynamic(
  () => import('./MarkdownEditor').then((mod) => mod.MarkdownEditor),
  {
    ssr: false, // 禁用 SSR，编辑器只在客户端渲染
    loading: () => <EditorSkeleton />,
  }
)

