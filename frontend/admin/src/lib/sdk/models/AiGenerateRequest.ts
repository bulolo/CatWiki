/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * AI 生成字段请求
 */
export type AiGenerateRequest = {
    /**
     * 文章正文内容（前端截断后传入）
     */
    content: string;
    /**
     * 需要生成的字段列表
     */
    fields: Array<'summary' | 'tags'>;
    /**
     * 摘要最大字数限制
     */
    summary_max_length?: (number | null);
    /**
     * 标签最大个数限制
     */
    tags_max_count?: (number | null);
};

