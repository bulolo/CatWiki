/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_PaginatedResponse_Site__ } from '../models/ApiResponse_PaginatedResponse_Site__';
import type { ApiResponse_Site_ } from '../models/ApiResponse_Site_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SitesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Active Sites
     * 获取激活的站点列表（客户端）
     * @returns ApiResponse_PaginatedResponse_Site__ Successful Response
     * @throws ApiError
     */
    public listClientSites({
        page = 1,
        size = 10,
        xTenantSlug,
    }: {
        page?: number,
        size?: number,
        xTenantSlug?: (string | null),
    }): CancelablePromise<ApiResponse_PaginatedResponse_Site__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites',
            headers: {
                'X-Tenant-Slug': xTenantSlug,
            },
            query: {
                'page': page,
                'size': size,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Site By Slug
     * 通过 slug 获取站点详情（客户端）
     * @returns ApiResponse_Site_ Successful Response
     * @throws ApiError
     */
    public getClientSiteBySlug({
        slug,
        xTenantSlug,
    }: {
        slug: string,
        xTenantSlug?: (string | null),
    }): CancelablePromise<ApiResponse_Site_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites:bySlug/{slug}',
            path: {
                'slug': slug,
            },
            headers: {
                'X-Tenant-Slug': xTenantSlug,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Site
     * 获取站点详情（客户端）
     * @returns ApiResponse_Site_ Successful Response
     * @throws ApiError
     */
    public getClientSite({
        siteId,
        xTenantSlug,
    }: {
        siteId: number,
        xTenantSlug?: (string | null),
    }): CancelablePromise<ApiResponse_Site_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites/{site_id}',
            path: {
                'site_id': siteId,
            },
            headers: {
                'X-Tenant-Slug': xTenantSlug,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
