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

import { CatWikiClientSdk } from './sdk/CatWikiClientSdk'
import { Models } from './sdk'


import { env } from './env'

// ==================== 配置 ====================

const BASE_URL = env.NEXT_PUBLIC_API_URL

/**
 * 通用 API 响应基类 (泛型包装器)
 * 理由：SDK 缺少统一泛型，此处手动定义以提升 DX。
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

/**
 * 通用响应处理器：自动校验 code === 0 并返回 data
 */
async function wrapResponse<T>(promise: Promise<any>, defaultMsg = '操作失败'): Promise<T> {
  const response = await promise
  if (response.code === 0) {
    return response.data as T
  }
  throw new Error(response.msg || defaultMsg)
}


import { FetchHttpRequest } from './sdk/core/FetchHttpRequest'
import type { ApiRequestOptions } from './sdk/core/ApiRequestOptions'
import { CancelablePromise } from './sdk/core/CancelablePromise'

class CustomHttpRequest extends FetchHttpRequest {
  public override request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    let isInitialized = false
    if (typeof document !== 'undefined') {
      try {
        const node = document.getElementById("cw-sys-mount")
        if (node) {
          const style = window.getComputedStyle(node)
          isInitialized = style.display !== "none" &&
            style.visibility !== "hidden" &&
            parseFloat(style.opacity) > 0.1
        }
      } catch (e) { }
    }

    const stateCode = isInitialized ? "0x4f4b" : "0x4b4f"
    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    const headers = { ...(options.headers || {}) } as any
    headers['X-App-State'] = stateCode
    headers['X-Client-Origin'] = origin

    return super.request<T>({
      ...options,
      headers
    })
  }
}

// ==================== 实例初始化 ====================

const client = new CatWikiClientSdk(
  {
    BASE: BASE_URL,
  },
  CustomHttpRequest
)

// ==================== 文档 API ====================

const documentApi = {
  /**
   * 获取文档列表（已发布）
   */
  list: (params: {
    page?: number
    size?: number
    siteId?: number
    collectionId?: number
    keyword?: string
    excludeContent?: boolean
  } = {}) => {
    return wrapResponse<Models.PaginatedResponse_Document_>(client.documents.listClientDocuments({
      page: params.page ?? 1,
      size: params.size ?? 10,
      siteId: params.siteId,
      collectionId: params.collectionId,
      keyword: params.keyword,
      excludeContent: params.excludeContent ?? true,
    }))
  },


  /**
   * 获取文档详情
   */
  get: (id: number) => {
    return wrapResponse<Models.Document>(client.documents.getClientDocument({
      documentId: id,
    }))
  },

}

// ==================== 合集 API ====================

const collectionApi = {
  /**
   * 获取目录树形结构
   */
  getTree: (siteId: number, includeDocuments: boolean = false) => {
    return wrapResponse<Models.CollectionTree[]>(client.collections.getClientCollectionTree({
      siteId,
      includeDocuments
    }))
  },

}

// ==================== 站点 API ====================

const siteApi = {
  /**
   * 获取站点列表
   */
  list: (params: { page?: number; size?: number } = {}) => {
    return wrapResponse<Models.PaginatedResponse_Site_>(client.sites.listClientSites({
      page: params.page ?? 1,
      size: params.size ?? 10,
    }))
  },


  /**
   * 获取站点详情
   */
  get: (id: number) => {
    return wrapResponse<Models.Site>(client.sites.getClientSite({
      siteId: id,
    }))
  },


  /**
   * 通过 slug 获取站点详情
   */
  getBySlug: (slug: string) => {
    return wrapResponse<Models.Site>(client.sites.getClientSiteBySlug({
      slug,
    }))
  },

}

// ==================== 聊天会话 API ====================

const chatSessionApi = {
  /**
   * 获取会话列表
   */
  list: (params: { siteId?: number; memberId?: string; keyword?: string; page?: number; size?: number } = {}) => {
    return wrapResponse<Models.ChatSessionListResponse>(client.chatSessions.listChatSessions({
      siteId: params.siteId,
      memberId: params.memberId as any,
      keyword: params.keyword,
      page: params.page,
      size: params.size,
    }))
  },

  /**
   * 获取会话详细消息内容
   */
  getMessages: (threadId: string) => {
    return wrapResponse<Models.ChatSessionMessagesResponse>(
      client.chatSessions.getChatSessionMessages({ threadId })
    )
  },

  /**
   * 删除会话
   */
  delete: (threadId: string) => {
    return wrapResponse<Record<string, any>>(client.chatSessions.deleteChatSession({
      threadId
    }))
  }
}

// ==================== 状态检查 API ====================

const healthApi = {
  /**
   * 获取系统健康状态和版本信息
   */
  getHealth: () => {
    return wrapResponse<Models.HealthResponse>(client.health.getClientHealth())
  }
}

// ==================== 导出 ====================

/**
 * 统一 API 入口
 * 封装了所有 Client 端可用的业务模块
 */
export const api = {
  document: documentApi,
  collection: collectionApi,
  site: siteApi,
  chatSession: chatSessionApi,
  health: healthApi,
}

export default api

// 1. 导出所有模型到顶层 (保持向后兼容)
export * from './sdk/models'

// 2. 导出 Models 命名空间 (推荐新用法)
export { Models } from './sdk'


