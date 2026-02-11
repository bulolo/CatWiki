/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AIConfigUpdate } from '../models/AIConfigUpdate';
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { ApiResponse_SystemConfigResponse_ } from '../models/ApiResponse_SystemConfigResponse_';
import type { ApiResponse_Union_dict__NoneType__ } from '../models/ApiResponse_Union_dict__NoneType__';
import type { ApiResponse_Union_SystemConfigResponse__NoneType__ } from '../models/ApiResponse_Union_SystemConfigResponse__NoneType__';
import type { DocProcessorsUpdate } from '../models/DocProcessorsUpdate';
import type { TestConnectionRequest } from '../models/TestConnectionRequest';
import type { TestDocProcessorRequest } from '../models/TestDocProcessorRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminSystemConfigsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Ai Config
     * 获取 AI 模型配置
     * @returns ApiResponse_Union_SystemConfigResponse__NoneType__ Successful Response
     * @throws ApiError
     */
    public getAdminAiConfig({
        scope = 'tenant',
    }: {
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_Union_SystemConfigResponse__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs/ai-config',
            query: {
                'scope': scope,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Ai Config
     * 更新 AI 模型配置 (扁平结构)
     * @returns ApiResponse_SystemConfigResponse_ Successful Response
     * @throws ApiError
     */
    public updateAdminAiConfig({
        requestBody,
        scope = 'tenant',
    }: {
        requestBody: AIConfigUpdate,
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_SystemConfigResponse_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/system-configs/ai-config',
            query: {
                'scope': scope,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Config
     * 删除指定配置
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public deleteAdminConfig({
        configKey,
        scope = 'tenant',
    }: {
        configKey: string,
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/system-configs/{config_key}',
            path: {
                'config_key': configKey,
            },
            query: {
                'scope': scope,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Test Model Connection
     * 测试模型连接性
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public testModelConnection({
        requestBody,
        scope = 'tenant',
    }: {
        requestBody: TestConnectionRequest,
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/system-configs/ai-config/test-connection',
            query: {
                'scope': scope,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Doc Processor Config
     * 获取文档处理服务配置
     * @returns ApiResponse_Union_dict__NoneType__ Successful Response
     * @throws ApiError
     */
    public getAdminDocProcessorConfig({
        scope = 'tenant',
    }: {
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_Union_dict__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs/doc-processor',
            query: {
                'scope': scope,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Doc Processor Config
     * 更新文档处理服务配置
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public updateAdminDocProcessorConfig({
        requestBody,
        scope = 'tenant',
    }: {
        requestBody: DocProcessorsUpdate,
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/system-configs/doc-processor',
            query: {
                'scope': scope,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Test Doc Processor Connection
     * 测试文档处理服务连接性
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public testDocProcessorConnection({
        requestBody,
        scope = 'tenant',
    }: {
        requestBody: TestDocProcessorRequest,
        scope?: 'platform' | 'tenant',
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/system-configs/doc-processor/test-connection',
            query: {
                'scope': scope,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
