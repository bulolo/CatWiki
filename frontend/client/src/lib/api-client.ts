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


// ==================== 实例初始化 ====================

const client = new CatWikiClientSdk({
  BASE: BASE_URL,
})

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
   * 通过 domain 获取站点详情
   */
  getByDomain: (domain: string) => {
    return wrapResponse<Models.Site>(client.sites.getClientSiteByDomain({
      domain,
    }))
  },

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
}

export default api

// 1. 导出所有模型到顶层 (保持向后兼容)
export * from './sdk/models'

// 2. 导出 Models 命名空间 (推荐新用法)
export { Models } from './sdk'


