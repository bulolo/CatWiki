/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_HealthResponse_ } from '../models/ApiResponse_HealthResponse_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminHealthService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 健康检查
     * 检查 API 服务、数据库连接和对象存储状态
     * @returns ApiResponse_HealthResponse_ Successful Response
     * @throws ApiError
     */
    public getAdminHealth(): CancelablePromise<ApiResponse_HealthResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/health',
        });
    }
}
