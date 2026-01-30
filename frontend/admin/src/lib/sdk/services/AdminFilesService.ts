/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { Body_batchUploadAdminFiles } from '../models/Body_batchUploadAdminFiles';
import type { Body_uploadAdminFile } from '../models/Body_uploadAdminFile';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminFilesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Upload File
     * 上传文件到 RustFS
     *
     * Args:
     * file: 上传的文件
     * folder: 存储文件夹路径（默认: uploads）
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 上传成功后的文件信息
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public uploadAdminFile({
        formData,
        folder = 'uploads',
    }: {
        formData: Body_uploadAdminFile,
        /**
         * 存储文件夹
         */
        folder?: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/files:upload',
            query: {
                'folder': folder,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Upload Multiple Files
     * 批量上传文件到 RustFS
     *
     * Args:
     * files: 上传的多个文件
     * folder: 存储文件夹路径
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 上传结果列表
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public batchUploadAdminFiles({
        formData,
        folder = 'uploads',
    }: {
        formData: Body_batchUploadAdminFiles,
        /**
         * 存储文件夹
         */
        folder?: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/files:batchUpload',
            query: {
                'folder': folder,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Download File
     * 下载文件
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 文件内容
     * @returns any Successful Response
     * @throws ApiError
     */
    public downloadAdminFile({
        objectName,
    }: {
        objectName: string,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/files/{object_name}:download',
            path: {
                'object_name': objectName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete File
     * 删除文件
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 删除结果
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteAdminFile({
        objectName,
    }: {
        objectName: string,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/files/{object_name}',
            path: {
                'object_name': objectName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Files
     * 列出文件
     *
     * Args:
     * prefix: 文件路径前缀（用于过滤）
     * recursive: 是否递归列出子目录
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 文件列表
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public listAdminFiles({
        prefix = '',
        recursive = true,
    }: {
        /**
         * 文件路径前缀
         */
        prefix?: string,
        /**
         * 是否递归列出
         */
        recursive?: boolean,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/files:list',
            query: {
                'prefix': prefix,
                'recursive': recursive,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get File Info
     * 获取文件信息
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 文件详细信息
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getAdminFileInfo({
        objectName,
    }: {
        objectName: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/files/{object_name}:info',
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
     * 获取文件的预签名 URL（用于临时访问私有文件）
     *
     * 注意：如果存储桶是公开的，可以直接使用 /info 接口返回的 url
     *
     * Args:
     * object_name: 文件对象名称（路径）
     * expires_hours: URL 有效期（小时，默认 1 小时，最长 7 天）
     * rustfs: RustFS 服务实例
     * current_user: 当前登录用户
     *
     * Returns:
     * 预签名 URL
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public getAdminPresignedUrl({
        objectName,
        expiresHours = 1,
    }: {
        objectName: string,
        /**
         * URL 有效期（小时）
         */
        expiresHours?: number,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/files/{object_name}:presignedUrl',
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
