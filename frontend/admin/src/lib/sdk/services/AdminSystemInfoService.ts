/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminSystemInfoService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 获取系统引擎信息
     * 并发探活四大基础引擎，返回当前系统运行时状态。
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getSystemInfo(): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-info',
        });
    }
}
