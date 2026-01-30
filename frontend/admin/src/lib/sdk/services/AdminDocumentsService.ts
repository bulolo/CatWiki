/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_Document_ } from '../models/ApiResponse_Document_';
import type { ApiResponse_list_dict__ } from '../models/ApiResponse_list_dict__';
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { ApiResponse_PaginatedResponse_Document__ } from '../models/ApiResponse_PaginatedResponse_Document__';
import type { ApiResponse_VectorizeResponse_ } from '../models/ApiResponse_VectorizeResponse_';
import type { ApiResponse_VectorRetrieveResult_ } from '../models/ApiResponse_VectorRetrieveResult_';
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
     * 获取文档列表（分页）
     * @returns ApiResponse_PaginatedResponse_Document__ Successful Response
     * @throws ApiError
     */
    public listAdminDocuments({
        page = 1,
        size = 10,
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
         * 向量化状态过滤: none, pending, processing, completed, failed
         */
        vectorStatus?: (string | null),
        /**
         * 搜索关键词
         */
        keyword?: (string | null),
        /**
         * 排序字段: views, updated_at
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
     * 创建文档
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
     * 获取文档详情（管理后台查看，不增加浏览量）
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
     * 更新文档
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
     * 删除文档
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
     * 向量化单个文档（会启动向量化后台任务）
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
     * 移除文档向量（从向量库删除并重置状态为 none）
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
     * 获取文档的向量切片信息
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
     * 语义检索向量数据库 (delegates to VectorService)
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
            url: '/admin/v1/documents/retrieve',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
