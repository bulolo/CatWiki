/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_DataSource_ } from '../models/ApiResponse_DataSource_';
import type { ApiResponse_list_DataSource__ } from '../models/ApiResponse_list_DataSource__';
import type { ApiResponse_list_dict__ } from '../models/ApiResponse_list_dict__';
import type { ApiResponse_list_S3FileItem__ } from '../models/ApiResponse_list_S3FileItem__';
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { ApiResponse_UploadedFile_ } from '../models/ApiResponse_UploadedFile_';
import type { Body_uploadToDataSource } from '../models/Body_uploadToDataSource';
import type { DataSourceCreate } from '../models/DataSourceCreate';
import type { DataSourceImportRequest } from '../models/DataSourceImportRequest';
import type { DataSourceUpdate } from '../models/DataSourceUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminDataSourcesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Data Sources
     * @returns ApiResponse_list_DataSource__ Successful Response
     * @throws ApiError
     */
    public listDataSources(): CancelablePromise<ApiResponse_list_DataSource__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/data-sources',
        });
    }
    /**
     * Create Data Source
     * @returns ApiResponse_DataSource_ Successful Response
     * @throws ApiError
     */
    public createDataSource({
        requestBody,
    }: {
        requestBody: DataSourceCreate,
    }): CancelablePromise<ApiResponse_DataSource_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/data-sources',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Data Source
     * @returns ApiResponse_DataSource_ Successful Response
     * @throws ApiError
     */
    public updateDataSource({
        dsId,
        requestBody,
    }: {
        dsId: number,
        requestBody: DataSourceUpdate,
    }): CancelablePromise<ApiResponse_DataSource_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/data-sources/{ds_id}',
            path: {
                'ds_id': dsId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Data Source
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteDataSource({
        dsId,
    }: {
        dsId: number,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/data-sources/{ds_id}',
            path: {
                'ds_id': dsId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Browse Data Source
     * @returns ApiResponse_list_S3FileItem__ Successful Response
     * @throws ApiError
     */
    public browseDataSource({
        dsId,
        prefix = '',
    }: {
        dsId: number,
        /**
         * 浏览路径前缀
         */
        prefix?: string,
    }): CancelablePromise<ApiResponse_list_S3FileItem__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/data-sources/{ds_id}/browse',
            path: {
                'ds_id': dsId,
            },
            query: {
                'prefix': prefix,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Upload To Data Source
     * @returns ApiResponse_UploadedFile_ Successful Response
     * @throws ApiError
     */
    public uploadToDataSource({
        dsId,
        formData,
    }: {
        dsId: number,
        formData: Body_uploadToDataSource,
    }): CancelablePromise<ApiResponse_UploadedFile_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/data-sources/{ds_id}/upload',
            path: {
                'ds_id': dsId,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Data Source File
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteDataSourceFile({
        dsId,
        key,
    }: {
        dsId: number,
        /**
         * 完整文件路径
         */
        key: string,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/data-sources/{ds_id}/files',
            path: {
                'ds_id': dsId,
            },
            query: {
                'key': key,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Import From Data Source
     * @returns ApiResponse_list_dict__ Successful Response
     * @throws ApiError
     */
    public importFromDataSource({
        dsId,
        requestBody,
    }: {
        dsId: number,
        requestBody: DataSourceImportRequest,
    }): CancelablePromise<ApiResponse_list_dict__> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/data-sources/{ds_id}/import',
            path: {
                'ds_id': dsId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
