/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 向量化响应
 */
export type VectorizeResponse = {
    /**
     * 成功排队的文档数
     */
    success_count: number;
    /**
     * 失败的文档数
     */
    failed_count: number;
    /**
     * 已排队的文档ID列表
     */
    document_ids: Array<number>;
};

