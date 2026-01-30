/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DocumentStatus } from './DocumentStatus';
import type { VectorStatus } from './VectorStatus';
/**
 * 创建文档
 */
export type DocumentCreate = {
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
};

