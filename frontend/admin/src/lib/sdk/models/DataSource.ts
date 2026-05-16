/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 数据源响应
 */
export type DataSource = {
    id: number;
    created_at: string;
    updated_at: string;
    tenant_id: number;
    name: string;
    type: string;
    description: (string | null);
    config: Record<string, any>;
};

