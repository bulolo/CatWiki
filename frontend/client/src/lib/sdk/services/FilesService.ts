/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class FilesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Download File
     * 下载文件（客户端）
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * rustfs: RustFS 服务实例
     *
     * Returns:
     * 文件内容
     * @returns any Successful Response
     * @throws ApiError
     */
    public downloadClientFile({
        objectName,
    }: {
        objectName: string,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/files/{object_name}:download',
            path: {
                'object_name': objectName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get File Info
     * 获取文件信息（客户端）
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * rustfs: RustFS 服务实例
     *
     * Returns:
     * 文件基本信息（不包含敏感元数据）
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getClientFileInfo({
        objectName,
    }: {
        objectName: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/files/{object_name}:info',
            path: {
                'object_name': objectName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Presigned Url
     * 获取文件的访问 URL（客户端）
     *
     * 注意：如果存储桶是公开的，返回直接 URL；否则返回预签名 URL
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * expires_hours: 预签名 URL 有效期（小时，默认 1 小时，最长 24 小时）
     * rustfs: RustFS 服务实例
     *
     * Returns:
     * 文件访问 URL
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getClientPresignedUrl({
        objectName,
        expiresHours = 1,
    }: {
        objectName: string,
        /**
         * URL 有效期（小时，最长 24 小时）
         */
        expiresHours?: number,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/files/{object_name}:presignedUrl',
            path: {
                'object_name': objectName,
            },
            query: {
                'expires_hours': expiresHours,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
