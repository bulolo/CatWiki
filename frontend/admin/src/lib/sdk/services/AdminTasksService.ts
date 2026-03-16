/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_PaginatedResponse_Task__ } from '../models/ApiResponse_PaginatedResponse_Task__';
import type { ApiResponse_Task_ } from '../models/ApiResponse_Task_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminTasksService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Tasks
     * 获取异步任务列表
     * @returns ApiResponse_PaginatedResponse_Task__ Successful Response
     * @throws ApiError
     */
    public listTasksAdminV1TasksGet({
        page = 1,
        size = 20,
        siteId,
    }: {
        page?: number,
        size?: number,
        /**
         * 站点ID
         */
        siteId?: (number | null),
    }): CancelablePromise<ApiResponse_PaginatedResponse_Task__> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tasks',
            query: {
                'page': page,
                'size': size,
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Task Status
     * 获取单个任务详情和状态
     * @returns ApiResponse_Task_ Successful Response
     * @throws ApiError
     */
    public getTaskStatusAdminV1TasksTaskIdGet({
        taskId,
    }: {
        taskId: number,
    }): CancelablePromise<ApiResponse_Task_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/tasks/{task_id}',
            path: {
                'task_id': taskId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
