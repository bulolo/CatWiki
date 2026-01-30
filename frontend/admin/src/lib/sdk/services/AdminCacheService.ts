/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminCacheService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Cache Stats
     * 获取缓存统计信息
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getAdminCacheStats(): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/cache:stats',
        });
    }
    /**
     * Clear Cache
     * 清空所有缓存
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public clearAdminCache(): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/cache:clear',
        });
    }
}
