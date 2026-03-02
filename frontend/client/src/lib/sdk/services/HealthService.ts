/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_HealthResponse_ } from '../models/ApiResponse_HealthResponse_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class HealthService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 健康检查 (客户端)
     * 检查 API 服务状态并返回版本信息
     * @returns ApiResponse_HealthResponse_ Successful Response
     * @throws ApiError
     */
    public getClientHealth(): CancelablePromise<ApiResponse_HealthResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/health',
        });
    }
}
