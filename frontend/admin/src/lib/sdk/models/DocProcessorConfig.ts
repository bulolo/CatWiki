/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DocProcessorType } from './DocProcessorType';
/**
 * 单个文档处理服务配置
 */
export type DocProcessorConfig = {
    /**
     * 服务名称（用于标识）
     */
    name: string;
    /**
     * 服务类型
     */
    type: DocProcessorType;
    /**
     * API 端点地址
     */
    baseUrl: string;
    /**
     * API 密钥（可选）
     */
    apiKey?: string;
    /**
     * 是否启用
     */
    enabled?: boolean;
};

