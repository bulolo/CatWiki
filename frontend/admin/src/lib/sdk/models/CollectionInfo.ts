/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CollectionAncestor } from './CollectionAncestor';
/**
 * 文档关联的合集信息
 */
export type CollectionInfo = {
    /**
     * 合集ID
     */
    id: number;
    /**
     * 合集名称
     */
    title: string;
    /**
     * 父合集ID
     */
    parent_id?: (number | null);
    /**
     * 祖先合集链（从根到父级）
     */
    ancestors?: Array<CollectionAncestor>;
    /**
     * 合集完整路径（如: 流式细胞术基础 > 仪器与试剂 > 选购指南）
     */
    path: string;
};

