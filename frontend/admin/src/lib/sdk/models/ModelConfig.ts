/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 单个模型配置
 */
export type ModelConfig = {
    /**
     * 模型提供商
     */
    provider: string;
    /**
     * 模型名称
     */
    model: string;
    /**
     * API Key
     */
    apiKey: string;
    /**
     * API Base URL
     */
    baseUrl: string;
    /**
     * Embedding 维度 (自动探测)
     */
    dimension?: (number | null);
    /**
     * 配置模式: custom=自定义, platform=使用平台资源
     */
    mode?: ModelConfig.mode;
};
export namespace ModelConfig {
    /**
     * 配置模式: custom=自定义, platform=使用平台资源
     */
    export enum mode {
        CUSTOM = 'custom',
        PLATFORM = 'platform',
    }
}

