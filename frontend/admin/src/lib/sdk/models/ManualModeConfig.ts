/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelConfig } from './ModelConfig';
/**
 * 手动模式配置
 */
export type ManualModeConfig = {
    /**
     * 对话模型配置
     */
    chat: ModelConfig;
    /**
     * 向量模型配置
     */
    embedding: ModelConfig;
    /**
     * 重排序模型配置
     */
    rerank: ModelConfig;
    /**
     * 视觉模型配置
     */
    vl: ModelConfig;
};

