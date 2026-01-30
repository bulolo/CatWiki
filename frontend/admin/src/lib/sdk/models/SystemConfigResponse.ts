/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 系统配置响应
 */
export type SystemConfigResponse = {
    /**
     * 配置键
     */
    config_key: string;
    /**
     * 配置值
     */
    config_value: Record<string, any>;
    /**
     * 配置描述
     */
    description?: (string | null);
    /**
     * 是否启用
     */
    is_active?: boolean;
    /**
     * 配置ID
     */
    id: number;
    /**
     * 创建时间
     */
    created_at: string;
    /**
     * 更新时间
     */
    updated_at: string;
};

