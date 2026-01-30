/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRole } from './UserRole';
/**
 * 邀请用户请求
 */
export type UserInvite = {
    /**
     * 邮箱
     */
    email: string;
    /**
     * 用户角色
     */
    role?: UserRole;
    /**
     * 管理的站点ID列表
     */
    managed_site_ids?: Array<number>;
};

