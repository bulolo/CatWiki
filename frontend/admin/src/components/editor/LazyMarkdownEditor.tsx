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

