/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRole } from './UserRole';
import type { UserStatus } from './UserStatus';
/**
 * 更新用户请求
 */
export type UserUpdate = {
    /**
     * 用户名
     */
    name?: (string | null);
    /**
     * 邮箱
     */
    email?: (string | null);
    /**
     * 用户角色
     */
    role?: (UserRole | null);
    /**
     * 管理的站点ID列表
     */
    managed_site_ids?: (Array<number> | null);
    /**
     * 用户状态
     */
    status?: (UserStatus | null);
    /**
     * 头像URL
     */
    avatar_url?: (string | null);
};

