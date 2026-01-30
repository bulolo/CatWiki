/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 创建合集
 */
export type CollectionCreate = {
    /**
     * 合集名称
     */
    title: string;
    /**
     * 所属站点ID
     */
    site_id: number;
    /**
     * 父合集ID
     */
    parent_id?: (number | null);
    /**
     * 排序
     */
    order?: number;
};

