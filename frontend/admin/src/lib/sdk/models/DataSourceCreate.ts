/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 创建数据源
 */
export type DataSourceCreate = {
    /**
     * 数据源名称
     */
    name: string;
    /**
     * 类型: internal | s3
     */
    type: DataSourceCreate.type;
    /**
     * 描述
     */
    description?: (string | null);
    /**
     * 连接配置（external S3 时必填）
     */
    config?: Record<string, any>;
};
export namespace DataSourceCreate {
    /**
     * 类型: internal | s3
     */
    export enum type {
        INTERNAL = 'internal',
        S3 = 's3',
    }
}

