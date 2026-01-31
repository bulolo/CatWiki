import { CatWikiAdminSdk } from './sdk/CatWikiAdminSdk'
import { getToken, clearAllAuth } from './auth'
import { FetchHttpRequest } from './sdk/core/FetchHttpRequest'
import { ApiError } from './sdk/core/ApiError'
import type { ApiRequestOptions } from './sdk/core/ApiRequestOptions'
import { CancelablePromise } from './sdk/core/CancelablePromise'
import { env } from './env'

// ==================== 集中导入常用模型 ====================
// 1. 导出所有模型到顶层 (保持向后兼容)
export * from './sdk/models'

// 2. 导出 Models 命名空间 (推荐新用法)
export { Models } from './sdk'

// 3. 内部使用
import { Models } from './sdk'




// ==================== 配置 ====================

const BASE_URL = env.NEXT_PUBLIC_API_URL

// ==================== 类型定义 ====================

/**
 * 通用 API 响应基类
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

/**
 * 分页数据包装格式
 */
export interface PaginatedData<T> {
  list: T[]
  pagination?: {
    total: number
    page: number
    size: number
  }
}

// ==================== 认证与错误处理 ====================

function handleUnauthorized() {
  clearAllAuth()
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname
    if (currentPath !== '/login') {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
    }
  }
}

class CustomHttpRequest extends FetchHttpRequest {
  public override request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    const originalPromise = super.request<T>(options)

    return new CancelablePromise<T>(async (resolve, reject, onCancel) => {
      onCancel(() => originalPromise.cancel())

      try {
        const result = await originalPromise
        resolve(result)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorized()
        }
        reject(error)
      }
    })
  }
}

// ==================== 实例初始化 ====================

const client = new CatWikiAdminSdk(
  {
    BASE: BASE_URL,
    TOKEN: async () => getToken() || '',
  },
  CustomHttpRequest
)

/**
 * 通用响应处理器：自动校验 code === 0 并返回 data
 */
async function wrapResponse<T>(promise: CancelablePromise<any>, defaultMsg = '操作失败'): Promise<T> {
  const response = await promise
  if (response.code === 0) {
    return response.data as T
  }
  throw new Error(response.msg || defaultMsg)
}

// ==================== API 模块 ====================

const siteApi = {
  list: (params: { page?: number; size?: number; status?: string } = {}) =>
    wrapResponse<Models.PaginatedResponse_Site_>(client.adminSites.listAdminSites({
      page: params.page ?? 1,
      size: params.size ?? 10,
      status: params.status,
    })),

  get: (id: number) =>
    wrapResponse<Models.Site>(client.adminSites.getAdminSite({ siteId: id })),

  getByDomain: (domain: string) =>
    wrapResponse<Models.Site>(client.adminSites.getAdminSiteByDomain({ domain })),

  create: (data: Models.SiteCreate) =>
    wrapResponse<Models.Site>(client.adminSites.createAdminSite({ requestBody: data })),

  update: (id: number, data: Models.SiteUpdate) =>
    wrapResponse<Models.Site>(client.adminSites.updateAdminSite({ siteId: id, requestBody: data })),

  delete: (id: number) =>
    wrapResponse<void>(client.adminSites.deleteAdminSite({ siteId: id })),
}


const collectionApi = {
  list: (params: { siteId: number; parentId?: number }) =>
    wrapResponse<Models.Collection[]>(client.adminCollections.listAdminCollections(params)),

  getTree: (siteId: number, type?: string) =>
    wrapResponse<Models.CollectionTree[]>(client.adminCollections.getAdminCollectionTree({ siteId, type })),

  get: (id: number) =>
    wrapResponse<Models.Collection>(client.adminCollections.getAdminCollection({ collectionId: id })),

  create: (data: Models.CollectionCreate) =>
    wrapResponse<Models.Collection>(client.adminCollections.createAdminCollection({ requestBody: data })),

  update: (id: number, data: Models.CollectionUpdate) =>
    wrapResponse<Models.Collection>(client.adminCollections.updateAdminCollection({ collectionId: id, requestBody: data })),

  delete: (id: number) =>
    wrapResponse<void>(client.adminCollections.deleteAdminCollection({ collectionId: id })),

  moveCollection: (params: {
    collectionId: number
    requestBody: { target_parent_id: number | null; target_position: number }
  }) => wrapResponse<void>(client.adminCollections.moveAdminCollection(params)),
}


const documentApi = {
  list: (params: {
    page?: number; size?: number; siteId?: number; collectionId?: number;
    status?: string; vectorStatus?: string; keyword?: string;
    orderBy?: 'views' | 'updated_at'; orderDir?: 'asc' | 'desc'
  } = {}) => wrapResponse<Models.PaginatedResponse_Document_>(client.adminDocuments.listAdminDocuments({
    ...params,
    page: params.page ?? 1,
    size: params.size ?? 10,
    orderDir: params.orderDir ?? 'desc',
  })),

  get: (id: number) =>
    wrapResponse<Models.Document>(client.adminDocuments.getAdminDocument({ documentId: id })),

  create: (data: Models.DocumentCreate) =>
    wrapResponse<Models.Document>(client.adminDocuments.createAdminDocument({ requestBody: data })),

  update: (id: number, data: Models.DocumentUpdate) =>
    wrapResponse<Models.Document>(client.adminDocuments.updateAdminDocument({ documentId: id, requestBody: data })),

  delete: (id: number) =>
    wrapResponse<void>(client.adminDocuments.deleteAdminDocument({ documentId: id })),

  vectorize: (documentIds: number[]) =>
    wrapResponse<Models.VectorizeResponse>(client.adminDocuments.batchVectorizeAdminDocuments({ requestBody: { document_ids: documentIds } })),

  vectorizeSingle: (documentId: number) =>
    wrapResponse<Models.Document>(client.adminDocuments.vectorizeAdminDocument({ documentId })),

  removeVector: (documentId: number) =>
    wrapResponse<Models.Document>(client.adminDocuments.removeAdminDocumentVector({ documentId })),

  listChunks: (documentId: number) =>
    wrapResponse<any>(client.adminDocuments.getAdminDocumentChunks({ documentId })),

  retrieveVectors: (params: {
    query: string; k?: number; threshold?: number;
    filter?: { site_id?: number; id?: string; source?: string };
    enable_rerank?: boolean; rerank_k?: number;
  }) => wrapResponse<any>(client.adminDocuments.retrieveDocuments({
    requestBody: {
      ...params,
      k: params.k ?? 5,
      threshold: params.threshold ?? 0.3,
    }
  })),
}


const userApi = {
  list: (params: any = {}) => wrapResponse<Models.PaginatedResponse_UserListItem_>(client.adminUsers.listAdminUsers(params)),
  get: (userId: number) => wrapResponse<Models.UserResponse>(client.adminUsers.getAdminUser({ userId })),
  create: (data: Models.UserCreate) => wrapResponse<Models.UserResponse>(client.adminUsers.createAdminUser({ requestBody: data })),
  invite: (data: Models.UserInvite) => wrapResponse<Models.UserLoginResponse>(client.adminUsers.inviteAdminUser({ requestBody: data })),
  update: (userId: number, data: Models.UserUpdate) => wrapResponse<Models.UserResponse>(client.adminUsers.updateAdminUser({ userId, requestBody: data })),
  updatePassword: (userId: number, data: any) => wrapResponse<void>(client.adminUsers.updateAdminUserPassword({ userId, requestBody: data })),
  resetPassword: (userId: number) => wrapResponse<any>(client.adminUsers.resetAdminUserPassword({ userId })),

  delete: (userId: number) => wrapResponse<void>(client.adminUsers.deleteAdminUser({ userId })),
  login: (data: Models.UserLogin) => wrapResponse<Models.UserLoginResponse>(client.adminUsers.loginAdmin({ requestBody: data })),
}


const systemConfigApi = {
  getAIConfig: () => wrapResponse<any>(client.adminSystemConfigs.getAdminAiConfig()),
  updateAIConfig: (config: Models.AIConfigUpdate) => wrapResponse<any>(client.adminSystemConfigs.updateAdminAiConfig({ requestBody: config })),
  getBotConfig: () => wrapResponse<any>(client.adminSystemConfigs.getAdminBotConfig()),
  updateBotConfig: (config: Models.BotConfigUpdate) => wrapResponse<any>(client.adminSystemConfigs.updateAdminBotConfig({ requestBody: config })),
  getAllConfigs: () => wrapResponse<any>(client.adminSystemConfigs.listAdminConfigs()),
  deleteConfig: (configKey: string) => wrapResponse<void>(client.adminSystemConfigs.deleteAdminConfig({ configKey })),
  testConnection: (modelType: string, config: any) => wrapResponse<any>(client.adminSystemConfigs.httpRequest.request({
    method: 'POST',
    url: '/admin/v1/system-configs/test-connection',
    body: { model_type: modelType, config },
  })),
}



const statsApi = {
  getSiteStats: (siteId: number) => wrapResponse<Models.SiteStats>(client.adminStats.getAdminSiteStats({ siteId })),
}


const fileApi = {
  uploadFile: (params: { formData: any; folder?: string }) => wrapResponse<any>(client.adminFiles.uploadAdminFile(params)),
  uploadMultipleFiles: (params: { formData: any; folder?: string }) => wrapResponse<any>(client.adminFiles.batchUploadAdminFiles(params)),
  listFiles: (params: any = {}) => wrapResponse<any>(client.adminFiles.listAdminFiles(params)),
  getFileInfo: (object_name: string) => wrapResponse<any>(client.adminFiles.getAdminFileInfo({ objectName: object_name })),
  getPresignedUrl: (object_name: string, expires_hours?: number) => wrapResponse<any>(client.adminFiles.getAdminPresignedUrl({ objectName: object_name, expiresHours: expires_hours })),
  deleteFile: (object_name: string) => wrapResponse<void>(client.adminFiles.deleteAdminFile({ objectName: object_name })),
}


// ==================== 导出 ====================

export const api = {
  site: siteApi,
  collection: collectionApi,
  document: documentApi,
  user: userApi,
  systemConfig: systemConfigApi,
  stats: statsApi,
  file: fileApi,
}

export default api

// 别名兼容
export type AIModelConfig = Models.AIConfigUpdate
export type BotConfig = Models.BotConfigUpdate

