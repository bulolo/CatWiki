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
 * React Query 配置
 */

import { QueryClient, DefaultOptions } from "@tanstack/react-query"

/**
 * 查询新鲜度时长枚举。
 * 业务侧选其中一档表达意图，避免散落的 5*60*1000 / 1000*60*5 等同值异写。
 */
export const STALE_TIME = {
  /** 总是过期 — 列表/分页这类要每次都拿最新的 */
  NONE: 0,
  /** 30 秒 — 健康检查、租户状态等高频变动 */
  SHORT: 30 * 1000,
  /** 5 分钟 — 默认档，多数列表与详情 */
  MEDIUM: 5 * 60 * 1000,
  /** 10 分钟 — 极少变动的全局配置 */
  LONG: 10 * 60 * 1000,
} as const

// 默认配置
const queryConfig: DefaultOptions = {
  queries: {
    staleTime: STALE_TIME.MEDIUM,
    // 缓存时间（10分钟）
    gcTime: 10 * 60 * 1000,
    // 失败后重试次数
    retry: 1,
    // 窗口聚焦时重新获取
    refetchOnWindowFocus: true,
    // 网络重新连接时重新获取
    refetchOnReconnect: true,
    // 挂载时不自动重新获取（除非过期）
    refetchOnMount: false,
  },
  mutations: {
    // mutation 失败后重试次数
    retry: 0,
  },
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  })
}

// 全局 QueryClient 实例（仅在客户端使用）
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === "undefined") {
    // 服务器端：总是创建新实例
    return makeQueryClient()
  } else {
    // 浏览器端：复用同一个实例
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }
    return browserQueryClient
  }
}




