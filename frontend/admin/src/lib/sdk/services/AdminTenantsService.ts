/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_NoneType_ } from '../models/ApiResponse_NoneType_';
import type { ApiResponse_PaginatedResponse_TenantSchema__ } from '../models/ApiResponse_PaginatedResponse_TenantSchema__';
import type { ApiResponse_TenantSchema_ } from '../models/ApiResponse_TenantSchema_';
import type { ApiResponse_Union_TenantSchema__NoneType__ } from '../models/ApiResponse_Union_TenantSchema__NoneType__';
import type { TenantCreateRequest } from '../models/TenantCreateRequest';
import type { TenantUpdate } from '../models/TenantUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminTenantsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 获取当前生效租户
     * 根据 Token 和 X-Selected-Tenant-ID Header 获取当前生效的租户详情
     * @returns ApiResponse_Union_TenantSchema__NoneType__ Successful Response
     * @throws ApiError
     */
    public getAdminCurrentTenant(): CancelablePromise<ApiResponse_Union_TenantSchema__NoneType__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tenants/current',
        });
    }
    /**
     * List Tenants
     * 获取租户列表
     * 仅限系统管理员 (ADMIN) 访问
     * @returns ApiResponse_PaginatedResponse_TenantSchema__ Successful Response
     * @throws ApiError
     */
    public listAdminTenants({
        page = 1,
        size = 10,
    }: {
        /**
         * 页码
         */
        page?: number,
        /**
         * 每页数量
         */
        size?: number,
    }): CancelablePromise<ApiResponse_PaginatedResponse_TenantSchema__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tenants',
            query: {
                'page': page,
                'size': size,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Tenant
     * 创建新租户
     * @returns ApiResponse_TenantSchema_ Successful Response
     * @throws ApiError
     */
    public createAdminTenant({
        requestBody,
    }: {
        requestBody: TenantCreateRequest,
    }): CancelablePromise<ApiResponse_TenantSchema_> {
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
     * @returns ApiResponse_TenantSchema_ Successful Response
     * @throws ApiError
     */
    public getAdminTenant({
        tenantId,
    }: {
        tenantId: number,
    }): CancelablePromise<ApiResponse_TenantSchema_> {
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
     * @returns ApiResponse_TenantSchema_ Successful Response
     * @throws ApiError
     */
    public updateAdminTenant({
        tenantId,
        requestBody,
    }: {
        tenantId: number,
        requestBody: TenantUpdate,
    }): CancelablePromise<ApiResponse_TenantSchema_> {
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
