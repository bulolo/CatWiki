/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRole } from './UserRole';
import type { UserStatus } from './UserStatus';
/**
 * 用户响应
 */
export type UserResponse = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    managed_site_ids: Array<number>;
    status: UserStatus;
    avatar_url?: (string | null);
    last_login_at?: (string | null);
    last_login_ip?: (string | null);
    created_at: string;
    updated_at: string;
};

