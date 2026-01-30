/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { ApiResponse_PaginatedResponse_UserListItem__ } from '../models/ApiResponse_PaginatedResponse_UserListItem__';
import type { ApiResponse_UserLoginResponse_ } from '../models/ApiResponse_UserLoginResponse_';
import type { ApiResponse_UserResponse_ } from '../models/ApiResponse_UserResponse_';
import type { UserCreate } from '../models/UserCreate';
import type { UserInvite } from '../models/UserInvite';
import type { UserLogin } from '../models/UserLogin';
import type { UserRole } from '../models/UserRole';
import type { UserStatus } from '../models/UserStatus';
import type { UserUpdate } from '../models/UserUpdate';
import type { UserUpdatePassword } from '../models/UserUpdatePassword';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminUsersService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Users
     * 获取用户列表
     *
     * - **page**: 页码
     * - **size**: 每页数量
     * - **role**: 角色筛选 (admin/site_admin/editor)
     * - **status**: 状态筛选 (active/inactive/pending)
     * - **search**: 搜索关键词（匹配用户名或邮箱）
     * - **site_id**: 站点ID筛选
     * - **order_by**: 排序字段
     * - **order_dir**: 排序方向 (asc/desc)
     * @returns ApiResponse_PaginatedResponse_UserListItem__ Successful Response
     * @throws ApiError
     */
    public listAdminUsers({
        page = 1,
        size = 10,
        role,
        status,
        search,
        siteId,
        orderBy = 'created_at',
        orderDir = 'desc',
    }: {
        /**
         * 页码
         */
        page?: number,
        /**
         * 每页数量
         */
        size?: number,
        /**
         * 角色筛选
         */
        role?: (UserRole | null),
        /**
         * 状态筛选
         */
        status?: (UserStatus | null),
        /**
         * 搜索关键词
         */
        search?: (string | null),
        /**
         * 站点ID筛选
         */
        siteId?: (number | null),
        /**
         * 排序字段
         */
        orderBy?: string,
        /**
         * 排序方向
         */
        orderDir?: 'asc' | 'desc',
    }): CancelablePromise<ApiResponse_PaginatedResponse_UserListItem__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/users',
            query: {
                'page': page,
                'size': size,
                'role': role,
                'status': status,
                'search': search,
                'site_id': siteId,
                'order_by': orderBy,
                'order_dir': orderDir,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create User
     * 创建用户
     *
     * - **name**: 用户名
     * - **email**: 邮箱
     * - **password**: 密码（至少6位）
     * - **role**: 角色（默认为 editor）
     * - **managed_site_ids**: 管理的站点ID列表
     * - **avatar_url**: 头像URL（可选）
     * @returns ApiResponse_UserResponse_ Successful Response
     * @throws ApiError
     */
    public createAdminUser({
        requestBody,
    }: {
        requestBody: UserCreate,
    }): CancelablePromise<ApiResponse_UserResponse_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/users',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get User
     * 获取用户详情
     * @returns ApiResponse_UserResponse_ Successful Response
     * @throws ApiError
     */
    public getAdminUser({
        userId,
    }: {
        userId: number,
    }): CancelablePromise<ApiResponse_UserResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update User
     * 更新用户信息
     *
     * - **name**: 用户名
     * - **email**: 邮箱
     * - **role**: 角色
     * - **managed_site_ids**: 管理的站点ID列表
     * - **status**: 状态
     * - **avatar_url**: 头像URL
     * @returns ApiResponse_UserResponse_ Successful Response
     * @throws ApiError
     */
    public updateAdminUser({
        userId,
        requestBody,
    }: {
        userId: number,
        requestBody: UserUpdate,
    }): CancelablePromise<ApiResponse_UserResponse_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/users/{user_id}',
            path: {
                'user_id': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete User
     * 删除用户
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public deleteAdminUser({
        userId,
    }: {
        userId: number,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Invite User
     * 邀请用户（直接创建用户并返回临时密码）
     *
     * - **email**: 邮箱
     * - **role**: 角色（默认为 editor）
     * - **managed_site_ids**: 管理的站点ID列表
     *
     * 返回创建的用户信息和临时密码
     * @returns any Successful Response
     * @throws ApiError
     */
    public inviteAdminUser({
        requestBody,
    }: {
        requestBody: UserInvite,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/users:invite',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update User Password
     * 更新用户密码
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public updateAdminUserPassword({
        userId,
        requestBody,
    }: {
        userId: number,
        requestBody: UserUpdatePassword,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/users/{user_id}/password',
            path: {
                'user_id': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Reset User Password
     * Reset user password (generate random temporary password)
     *
     * - Admin can reset password for any user
     * - Returns randomly generated temporary password
     * @returns any Successful Response
     * @throws ApiError
     */
    public resetAdminUserPassword({
        userId,
    }: {
        userId: number,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/users/{user_id}:resetPassword',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Login
     * 用户登录
     *
     * - **email**: 邮箱
     * - **password**: 密码
     * @returns ApiResponse_UserLoginResponse_ Successful Response
     * @throws ApiError
     */
    public loginAdmin({
        requestBody,
    }: {
        requestBody: UserLogin,
    }): CancelablePromise<ApiResponse_UserLoginResponse_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/users:login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
