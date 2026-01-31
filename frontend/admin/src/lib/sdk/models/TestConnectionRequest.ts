/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelConfig } from './ModelConfig';
/**
 * 测试连接请求
 */
export type TestConnectionRequest = {
    /**
     * 模型类型
     */
    model_type: TestConnectionRequest.model_type;
    /**
     * 模型配置
     */
    config: ModelConfig;
};
export namespace TestConnectionRequest {
    /**
     * 模型类型
     */
    export enum model_type {
        CHAT = 'chat',
        EMBEDDING = 'embedding',
        RERANK = 'rerank',
        VL = 'vl',
    }
}

