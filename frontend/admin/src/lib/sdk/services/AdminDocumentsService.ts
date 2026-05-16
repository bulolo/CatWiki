/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiGenerateRequest } from '../models/AiGenerateRequest';
import type { ApiResponse_AiGenerateResponse_ } from '../models/ApiResponse_AiGenerateResponse_';
import type { ApiResponse_Document_ } from '../models/ApiResponse_Document_';
import type { ApiResponse_list_dict__ } from '../models/ApiResponse_list_dict__';
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { ApiResponse_PaginatedResponse_Document__ } from '../models/ApiResponse_PaginatedResponse_Document__';
import type { ApiResponse_Task_ } from '../models/ApiResponse_Task_';
import type { ApiResponse_VectorizeResponse_ } from '../models/ApiResponse_VectorizeResponse_';
import type { ApiResponse_VectorRetrieveResult_ } from '../models/ApiResponse_VectorRetrieveResult_';
import type { Body_importDocument } from '../models/Body_importDocument';
import type { DocumentCreate } from '../models/DocumentCreate';
import type { DocumentUpdate } from '../models/DocumentUpdate';
import type { VectorizeRequest } from '../models/VectorizeRequest';
import type { VectorRetrieveRequest } from '../models/VectorRetrieveRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminDocumentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Documents
     * @returns ApiResponse_PaginatedResponse_Document__ Successful Response
     * @throws ApiError
     */
    public listAdminDocuments({
        page = 1,
        size = 10,
        isPager = 1,
        siteId,
        collectionId,
        status,
        vectorStatus,
        keyword,
        orderBy,
        orderDir,
        excludeContent = true,
    }: {
        page?: number,
        size?: number,
        /**
         * 是否分页，0=返回全部，1=分页
         */
        isPager?: number,
        /**
         * 站点ID
         */
        siteId?: (number | null),
        /**
         * 合集ID
         */
        collectionId?: (number | null),
        /**
         * 状态过滤: published, draft
         */
        status?: (string | null),
        /**
         * 向量化状态过滤: none, outdated, pending, processing, completed, failed
         */
        vectorStatus?: (string | null),
        /**
         * 搜索关键词
         */
        keyword?: (string | null),
        /**
         * 排序字段: views, created_at, updated_at
         */
        orderBy?: (string | null),
        /**
         * 排序方向: asc, desc
         */
        orderDir?: (string | null),
        /**
         * 是否排除文档内容（用于列表展示，提升性能）
         */
        excludeContent?: boolean,
    }): CancelablePromise<ApiResponse_PaginatedResponse_Document__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/documents',
            query: {
                'page': page,
                'size': size,
                'is_pager': isPager,
                'site_id': siteId,
                'collection_id': collectionId,
                'status': status,
                'vector_status': vectorStatus,
                'keyword': keyword,
                'order_by': orderBy,
                'order_dir': orderDir,
                'exclude_content': excludeContent,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Document
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public createAdminDocument({
        requestBody,
    }: {
        requestBody: DocumentCreate,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Document
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public getAdminDocument({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/documents/{document_id}',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Document
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public updateAdminDocument({
        documentId,
        requestBody,
    }: {
        documentId: number,
        requestBody: DocumentUpdate,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/documents/{document_id}',
            path: {
                'document_id': documentId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Document
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteAdminDocument({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/documents/{document_id}',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Import Document
     * 导入文档 (上传 -> 异步解析 -> 创建)
     * duplicate_strategy: "skip" = 已存在则跳过, "allow" = 不检测直接上传（默认）
     * auto_vectorize: 解析完成后是否自动入向量库（链一个向量化任务）
     * @returns ApiResponse_Task_ Successful Response
     * @throws ApiError
     */
    public importDocument({
        formData,
    }: {
        formData: Body_importDocument,
    }): CancelablePromise<ApiResponse_Task_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents:import',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Vectorize Documents
     * 批量向量化文档（将文档状态设置为 pending，并启动向量化后台任务）
     * @returns ApiResponse_VectorizeResponse_ Successful Response
     * @throws ApiError
     */
    public batchVectorizeAdminDocuments({
        requestBody,
    }: {
        requestBody: VectorizeRequest,
    }): CancelablePromise<ApiResponse_VectorizeResponse_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents:batchVectorize',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Vectorize Single Document
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public vectorizeAdminDocument({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents/{document_id}:vectorize',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Remove Document Vector
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public removeAdminDocumentVector({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents/{document_id}:removeVector',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Document Chunks
     * @returns ApiResponse_list_dict__ Successful Response
     * @throws ApiError
     */
    public getAdminDocumentChunks({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_list_dict__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/documents/{document_id}/chunks',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Retrieve Vectors
     * 语义检索向量数据库 (delegates to RAGService)
     * @returns ApiResponse_VectorRetrieveResult_ Successful Response
     * @throws ApiError
     */
    public retrieveDocuments({
        requestBody,
    }: {
        requestBody: VectorRetrieveRequest,
    }): CancelablePromise<ApiResponse_VectorRetrieveResult_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents:retrieve',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Ai Generate Fields
     * 用 AI 生成文档字段（摘要 / 标签）
     * - fields: ["summary"] / ["tags"] / ["summary", "tags"]
     * - content: 由前端截断后的文章正文，不超过调用方设定的字符上限
     * @returns ApiResponse_AiGenerateResponse_ Successful Response
     * @throws ApiError
     */
    public aiGenerateDocumentFields({
        requestBody,
    }: {
        requestBody: AiGenerateRequest,
    }): CancelablePromise<ApiResponse_AiGenerateResponse_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/documents:aiGenerate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
