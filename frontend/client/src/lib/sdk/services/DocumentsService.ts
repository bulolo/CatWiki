/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_Document_ } from '../models/ApiResponse_Document_';
import type { ApiResponse_PaginatedResponse_Document__ } from '../models/ApiResponse_PaginatedResponse_Document__';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DocumentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Published Documents
     * 获取已发布文档列表（客户端）
     * @returns ApiResponse_PaginatedResponse_Document__ Successful Response
     * @throws ApiError
     */
    public listClientDocuments({
        page = 1,
        size = 10,
        siteId,
        collectionId,
        keyword,
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
         * 搜索关键词
         */
        keyword?: (string | null),
        /**
         * 是否排除文档内容（用于列表展示，提升性能）
         */
        excludeContent?: boolean,
    }): CancelablePromise<ApiResponse_PaginatedResponse_Document__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/documents',
            query: {
                'page': page,
                'size': size,
                'site_id': siteId,
                'collection_id': collectionId,
                'keyword': keyword,
                'exclude_content': excludeContent,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Document
     * 获取文档详情（客户端，自动增加浏览量）
     * @returns ApiResponse_Document_ Successful Response
     * @throws ApiError
     */
    public getClientDocument({
        documentId,
    }: {
        documentId: number,
    }): CancelablePromise<ApiResponse_Document_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/documents/{document_id}',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
