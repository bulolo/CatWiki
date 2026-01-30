/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserRole } from './UserRole';
import type { UserStatus } from './UserStatus';
/**
 * 用户列表项
 */
export type UserListItem = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    managed_site_ids: Array<number>;
    status: UserStatus;
    last_login_at?: (string | null);
    created_at: string;
};

