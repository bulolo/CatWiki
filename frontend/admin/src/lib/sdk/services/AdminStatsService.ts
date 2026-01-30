/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_SiteStats_ } from '../models/ApiResponse_SiteStats_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminStatsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Site Stats
     * 获取站点统计数据
     *
     * 返回:
     * - total_documents: 文档总数
     * - total_views: 总访问次数
     * @returns ApiResponse_SiteStats_ Successful Response
     * @throws ApiError
     */
    public getAdminSiteStats({
        siteId,
    }: {
        /**
         * 站点ID
         */
        siteId: number,
    }): CancelablePromise<ApiResponse_SiteStats_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/stats:siteStats',
            query: {
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
