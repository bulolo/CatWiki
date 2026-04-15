/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { ApiResponse_PaginatedResponse_TenantEESchema__ } from '../models/ApiResponse_PaginatedResponse_TenantEESchema__';
import type { ApiResponse_TenantEESchema_ } from '../models/ApiResponse_TenantEESchema_';
import type { TenantCreateRequest } from '../models/TenantCreateRequest';
import type { TenantEEUpdate } from '../models/TenantEEUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EeAdminTenantsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Tenants
     * 获取租户列表
     * 仅限系统管理员 (ADMIN) 访问
     * @returns ApiResponse_PaginatedResponse_TenantEESchema__ Successful Response
     * @throws ApiError
     */
    public listAdminTenants({
        page = 1,
        size = 10,
        keyword,
        isPager = 1,
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
         * 搜索关键词
         */
        keyword?: (string | null),
        /**
         * 是否分页，0=返回全部，1=分页
         */
        isPager?: number,
    }): CancelablePromise<ApiResponse_PaginatedResponse_TenantEESchema__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tenants',
            query: {
                'page': page,
                'size': size,
                'keyword': keyword,
                'is_pager': isPager,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Tenant
     * 创建新租户
     * @returns ApiResponse_TenantEESchema_ Successful Response
     * @throws ApiError
     */
    public createAdminTenant({
        requestBody,
    }: {
        requestBody: TenantCreateRequest,
    }): CancelablePromise<ApiResponse_TenantEESchema_> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/admin/v1/tenants',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Tenant
     * 获取租户详情
     * @returns ApiResponse_TenantEESchema_ Successful Response
     * @throws ApiError
     */
    public getAdminTenant({
        tenantId,
    }: {
        tenantId: number,
    }): CancelablePromise<ApiResponse_TenantEESchema_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tenants/{tenant_id}',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Tenant
     * 更新租户
     * @returns ApiResponse_TenantEESchema_ Successful Response
     * @throws ApiError
     */
    public updateAdminTenant({
        tenantId,
        requestBody,
    }: {
        tenantId: number,
        requestBody: TenantEEUpdate,
    }): CancelablePromise<ApiResponse_TenantEESchema_> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/admin/v1/tenants/{tenant_id}',
            path: {
                'tenant_id': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Tenant
     * 删除租户
     * @returns ApiResponse_NoneType_ Successful Response
     * @throws ApiError
     */
    public deleteAdminTenant({
        tenantId,
    }: {
        tenantId: number,
    }): CancelablePromise<ApiResponse_NoneType_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/tenants/{tenant_id}',
            path: {
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
