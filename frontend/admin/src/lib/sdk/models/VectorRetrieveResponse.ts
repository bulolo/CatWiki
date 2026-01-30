/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 向量检索响应
 */
export type VectorRetrieveResponse = {
    /**
     * 文档片段内容
     */
    content: string;
    /**
     * 检索得分 (相似度)
     */
    score: number;
    /**
     * 原始检索得分 (重排序前)
     */
    original_score?: (number | null);
    /**
     * 文档 ID
     */
    document_id: number;
    /**
     * 文档标题
     */
    document_title?: (string | null);
    /**
     * 元数据
     */
    metadata?: Record<string, any>;
};

