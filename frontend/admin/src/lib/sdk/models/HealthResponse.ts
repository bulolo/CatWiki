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
     * CatWiki 版本 (community | enterprise)
     */
    edition: string;
    /**
     * 是否已获得企业级授权
     */
    is_licensed: boolean;
    /**
     * 检查时间戳
     */
    timestamp: string;
    /**
     * 各组件检查状态
     */
    checks: Record<string, string>;
};

