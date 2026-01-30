/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SystemConfigResponse } from './SystemConfigResponse';
export type ApiResponse_Union_SystemConfigResponse__NoneType__ = {
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
    data?: (SystemConfigResponse | null);
};

