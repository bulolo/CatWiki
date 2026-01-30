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
    }: {
        page?: number,
        size?: number,
    }): CancelablePromise<ApiResponse_PaginatedResponse_Site__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites',
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
     * Get Site By Domain
     * 通过 domain 获取站点详情（客户端）
     * @returns ApiResponse_Site_ Successful Response
     * @throws ApiError
     */
    public getClientSiteByDomain({
        domain,
    }: {
        domain: string,
    }): CancelablePromise<ApiResponse_Site_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/sites:byDomain/{domain}',
            path: {
                'domain': domain,
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
    }: {
        siteId: number,
    }): CancelablePromise<ApiResponse_Site_> {
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
