/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CollectionInfo } from './CollectionInfo';
import type { DocumentStatus } from './DocumentStatus';
import type { VectorStatus } from './VectorStatus';
/**
 * 文档详情
 */
export type Document = {
    id: number;
    created_at: string;
    updated_at: string;
    /**
     * 文章标题
     */
    title: string;
    /**
     * 文章内容(Markdown)
     */
    content?: (string | null);
    /**
     * 文章摘要
     */
    summary?: (string | null);
    /**
     * 封面图片URL
     */
    cover_image?: (string | null);
    /**
     * 所属站点ID
     */
    site_id: number;
    /**
     * 所属合集ID（必填）
     */
    collection_id: number;
    /**
     * 分类
     */
    category?: (string | null);
    /**
     * 作者
     */
    author: string;
    /**
     * 状态: published, draft
     */
    status?: DocumentStatus;
    /**
     * 向量化状态: none, pending, processing, completed, failed
     */
    vector_status?: VectorStatus;
    /**
     * 标签列表
     */
    tags?: (Array<string> | null);
    /**
     * 浏览量
     */
    views?: number;
    /**
     * 预计阅读时间(分钟)
     */
    reading_time?: number;
    /**
     * 向量化失败错误信息
     */
    vector_error?: (string | null);
    /**
     * 最后向量化完成时间
     */
    vectorized_at?: (string | null);
    /**
     * 站点名称
     */
    site_name?: (string | null);
    /**
     * 所属合集信息
     */
    collection?: (CollectionInfo | null);
};

