/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TenantSchema } from './TenantSchema';
export type ApiResponse_Union_TenantSchema__NoneType__ = {
    /**
     * 响应码，0 表示成功
     */
    code?: number;
    /**
     * 响应消息
     */
    msg?: string;
    /**
     * 响应数据
     */
    data?: (TenantSchema | null);
};

