/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_ClientSite_ } from '../models/ApiResponse_ClientSite_';
import type { ApiResponse_PaginatedResponse_ClientSite__ } from '../models/ApiResponse_PaginatedResponse_ClientSite__';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SitesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Active Sites
     * 获取激活的站点列表（客户端）
     *
     * - 不传 tenant_id：返回所有租户的激活站点（站点广场）
     * - 传 tenant_id：仅返回该租户下的激活站点
     * @returns ApiResponse_PaginatedResponse_ClientSite__ Successful Response
     * @throws ApiError
     */
    public listClientSites({
        page = 1,
        size = 10,
        tenantId,
        tenantSlug,
        keyword,
    }: {
        page?: number,
        size?: number,
        /**
         * 租户ID
         */
        tenantId?: (number | null),
        /**
         * 租户标识 (Portal 入口有效)
         */
        tenantSlug?: (string | null),
        /**
         * 搜索关键词（站点名称或描述）
         */
        keyword?: (string | null),
    }): CancelablePromise<ApiResponse_PaginatedResponse_ClientSite__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites',
            query: {
                'page': page,
                'size': size,
                'tenant_id': tenantId,
                'tenant_slug': tenantSlug,
                'keyword': keyword,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Site By Slug
     * 通过 slug 获取站点详情（客户端）
     * @returns ApiResponse_ClientSite_ Successful Response
     * @throws ApiError
     */
    public getClientSiteBySlug({
        slug,
    }: {
        slug: string,
    }): CancelablePromise<ApiResponse_ClientSite_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites:bySlug/{slug}',
            path: {
                'slug': slug,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Site
     * 获取站点详情（客户端）
     * @returns ApiResponse_ClientSite_ Successful Response
     * @throws ApiError
     */
    public getClientSite({
        siteId,
    }: {
        siteId: number,
    }): CancelablePromise<ApiResponse_ClientSite_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites/{site_id}',
            path: {
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
