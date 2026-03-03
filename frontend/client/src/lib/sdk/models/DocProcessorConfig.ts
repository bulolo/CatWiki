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
     * 唯一标识符
     */
    id?: string;
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
    base_url: string;
    /**
     * API 密钥（可选）
     */
    api_key?: string;
    /**
     * 是否启用
     */
    enabled?: boolean;
    /**
     * 额外配置（如 is_ocr）
     */
    config?: Record<string, any>;
};

