/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AIConfigUpdate } from '../models/AIConfigUpdate';
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { ApiResponse_SystemConfigResponse_ } from '../models/ApiResponse_SystemConfigResponse_';
import type { ApiResponse_Union_dict__NoneType__ } from '../models/ApiResponse_Union_dict__NoneType__';
import type { ApiResponse_Union_SystemConfigResponse__NoneType__ } from '../models/ApiResponse_Union_SystemConfigResponse__NoneType__';
import type { BotConfigUpdate } from '../models/BotConfigUpdate';
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
    public getAdminAiConfig(): CancelablePromise<ApiResponse_Union_SystemConfigResponse__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs/ai-config',
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
    }: {
        requestBody: AIConfigUpdate,
    }): CancelablePromise<ApiResponse_SystemConfigResponse_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/system-configs/ai-config',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Bot Config
     * 获取机器人配置
     *
     * 返回当前的机器人配置，包括网页挂件、API 接口和微信公众号设置
     * @returns ApiResponse_Union_SystemConfigResponse__NoneType__ Successful Response
     * @throws ApiError
     */
    public getAdminBotConfig(): CancelablePromise<ApiResponse_Union_SystemConfigResponse__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs/bot-config',
        });
    }
    /**
     * Update Bot Config
     * 更新机器人配置
     *
     * - **webWidget**: 网页挂件配置
     * - **apiBot**: API 机器人配置
     * - **wechat**: 微信公众号配置
     * @returns ApiResponse_SystemConfigResponse_ Successful Response
     * @throws ApiError
     */
    public updateAdminBotConfig({
        requestBody,
    }: {
        requestBody: BotConfigUpdate,
    }): CancelablePromise<ApiResponse_SystemConfigResponse_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/system-configs/bot-config',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get All Configs
     * 获取所有配置（便捷接口）
     *
     * 一次性获取所有系统配置
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public listAdminConfigs(): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs',
        });
    }
    /**
     * Delete Config
     * 删除指定配置
     *
     * - **config_key**: 配置键（如 'ai_config' 或 'bot_config'）
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public deleteAdminConfig({
        configKey,
    }: {
        configKey: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/system-configs/{config_key}',
            path: {
                'config_key': configKey,
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
    }: {
        requestBody: TestConnectionRequest,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/system-configs/test-connection',
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
     *
     * 返回当前配置的文档处理服务列表
     * @returns ApiResponse_Union_dict__NoneType__ Successful Response
     * @throws ApiError
     */
    public getAdminDocProcessorConfig(): CancelablePromise<ApiResponse_Union_dict__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/system-configs/doc-processor',
        });
    }
    /**
     * Update Doc Processor Config
     * 更新文档处理服务配置
     *
     * - **processors**: 文档处理服务列表
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public updateAdminDocProcessorConfig({
        requestBody,
    }: {
        requestBody: DocProcessorsUpdate,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/system-configs/doc-processor',
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
    }: {
        requestBody: TestDocProcessorRequest,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/system-configs/doc-processor/test',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
