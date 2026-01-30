/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AutoModeModels } from './AutoModeModels';
/**
 * 自动模式配置
 */
export type AutoModeConfig = {
    /**
     * 预设提供商
     */
    provider: AutoModeConfig.provider;
    /**
     * API Key
     */
    apiKey: string;
    /**
     * 模型选择
     */
    models: AutoModeModels;
};
export namespace AutoModeConfig {
    /**
     * 预设提供商
     */
    export enum provider {
        BAILIAN = 'bailian',
        OPENAI = 'openai',
        DEEPSEEK = 'deepseek',
    }
}

