/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRole } from './UserRole';
/**
 * 创建用户请求
 */
export type UserCreate = {
    /**
     * 用户名
     */
    name: string;
    /**
     * 邮箱
     */
    email: string;
    /**
     * 密码
     */
    password: string;
    /**
     * 所属租户ID(null=平台管理员)
     */
    tenant_id?: (number | null);
    /**
     * 用户角色
     */
    role?: UserRole;
    /**
     * 管理的站点ID列表
     */
    managed_site_ids?: Array<number>;
    /**
     * 头像URL
     */
    avatar_url?: (string | null);
};

