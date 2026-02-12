/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 健康检查响应
 */
export type HealthResponse = {
    /**
     * 服务总体状态: healthy, degraded, unhealthy
     */
    status: string;
    /**
     * API 版本
     */
    version: string;
    /**
     * 运行环境
     */
    environment: string;
    /**
     * 检查时间戳
     */
    timestamp: string;
    /**
     * 各组件检查状态
     */
    checks: Record<string, string>;
};

