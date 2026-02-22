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

/**
 * 全局类型定义
 *
 * ⚠️ 规范：与后端交互的数据类型统一从 @/lib/api-client (SDK) 导入
 *    此文件仅存放前端 UI 展示层专用类型
 */

// ==================== 前端 UI 专用类型 ====================

// 合集树项类型（用于侧边栏 UI 展示）
export interface CollectionItem {
  id: string
  name: string
  type?: 'collection' | 'document'
  children?: CollectionItem[]
  status?: string
  views?: number
  tags?: string[]
}

// 统计数据类型（Dashboard 展示）
export interface StatItem {
  title: string
  value: string
  description: string
  color: string
  bg: string
}

export interface HotDoc {
  title: string
  views: number
  category: string
}

export interface UpdateItem {
  title: string
  time: string
}

export interface SiteStats {
  stats: StatItem[]
  hotDocs: HotDoc[]
  updates: UpdateItem[]
}

// 目录项类型（用于拖拽排序 UI）
export interface DirectoryItem {
  id: string
  name: string
  type?: 'collection' | 'document'
  children?: DirectoryItem[]
}
