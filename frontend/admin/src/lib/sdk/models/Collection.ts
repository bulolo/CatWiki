/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 合集详情
 */
export type Collection = {
    id: number;
    created_at: string;
    updated_at: string;
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

