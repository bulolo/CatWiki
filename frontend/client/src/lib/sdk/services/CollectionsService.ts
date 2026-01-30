/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_list_CollectionTree__ } from '../models/ApiResponse_list_CollectionTree__';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class CollectionsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Collection Tree
     * 获取合集树形结构（客户端）
     * @returns ApiResponse_list_CollectionTree__ Successful Response
     * @throws ApiError
     */
    public getClientCollectionTree({
        siteId,
        includeDocuments = false,
    }: {
        /**
         * 站点ID
         */
        siteId: number,
        /**
         * 是否包含文档节点
         */
        includeDocuments?: boolean,
    }): CancelablePromise<ApiResponse_list_CollectionTree__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/collections:tree',
            query: {
                'site_id': siteId,
                'include_documents': includeDocuments,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
