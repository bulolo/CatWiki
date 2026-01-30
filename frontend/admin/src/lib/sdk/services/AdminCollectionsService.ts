/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_Collection_ } from '../models/ApiResponse_Collection_';
import type { ApiResponse_list_Collection__ } from '../models/ApiResponse_list_Collection__';
import type { ApiResponse_list_CollectionTree__ } from '../models/ApiResponse_list_CollectionTree__';
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { CollectionCreate } from '../models/CollectionCreate';
import type { CollectionUpdate } from '../models/CollectionUpdate';
import type { MoveCollectionRequest } from '../models/MoveCollectionRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminCollectionsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Collections
     * 获取合集列表
     * @returns ApiResponse_list_Collection__ Successful Response
     * @throws ApiError
     */
    public listAdminCollections({
        siteId,
        parentId,
    }: {
        siteId: number,
        /**
         * 父合集ID，为空则获取根合集
         */
        parentId?: (number | null),
    }): CancelablePromise<ApiResponse_list_Collection__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/collections',
            query: {
                'parent_id': parentId,
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Collection
     * 创建合集
     * @returns ApiResponse_Collection_ Successful Response
     * @throws ApiError
     */
    public createAdminCollection({
        requestBody,
    }: {
        requestBody: CollectionCreate,
    }): CancelablePromise<ApiResponse_Collection_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/collections',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Collection Tree
     * 获取合集树形结构（优化版：批量加载文档，避免N+1查询）
     * @returns ApiResponse_list_CollectionTree__ Successful Response
     * @throws ApiError
     */
    public getAdminCollectionTree({
        siteId,
        type,
    }: {
        siteId: number,
        /**
         * 树节点类型：不指定则显示合集和文档，'collection'则只显示合集
         */
        type?: (string | null),
    }): CancelablePromise<ApiResponse_list_CollectionTree__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/collections:tree',
            query: {
                'type': type,
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Collection
     * 获取合集详情
     * @returns ApiResponse_Collection_ Successful Response
     * @throws ApiError
     */
    public getAdminCollection({
        collectionId,
    }: {
        collectionId: number,
    }): CancelablePromise<ApiResponse_Collection_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Collection
     * 更新合集
     * @returns ApiResponse_Collection_ Successful Response
     * @throws ApiError
     */
    public updateAdminCollection({
        collectionId,
        requestBody,
    }: {
        collectionId: number,
        requestBody: CollectionUpdate,
    }): CancelablePromise<ApiResponse_Collection_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Collection
     * 删除合集
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteAdminCollection({
        collectionId,
    }: {
        collectionId: number,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/collections/{collection_id}',
            path: {
                'collection_id': collectionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Move Collection
     * 移动合集到新位置
     *
     * 这个接口会：
     * 1. 更新合集的 parent_id
     * 2. 重新计算目标父级下所有合集的 order，确保顺序连续
     * @returns ApiResponse_Collection_ Successful Response
     * @throws ApiError
     */
    public moveAdminCollection({
        collectionId,
        requestBody,
    }: {
        collectionId: number,
        requestBody: MoveCollectionRequest,
    }): CancelablePromise<ApiResponse_Collection_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/collections/{collection_id}:move',
            path: {
                'collection_id': collectionId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
