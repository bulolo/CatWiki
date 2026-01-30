/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { VectorRetrieveFilter } from './VectorRetrieveFilter';
/**
 * 向量检索请求
 */
export type VectorRetrieveRequest = {
    /**
     * 检索查询语句
     */
    query: string;
    /**
     * 返回结果数量
     */
    'k'?: number;
    /**
     * 相似度阈值
     */
    threshold?: number;
    /**
     * 过滤器 (可选)
     */
    filter?: (VectorRetrieveFilter | null);
    /**
     * 是否启用重排序
     */
    enable_rerank?: boolean;
    /**
     * 重排序后返回的数量
     */
    rerank_k?: number;
};

