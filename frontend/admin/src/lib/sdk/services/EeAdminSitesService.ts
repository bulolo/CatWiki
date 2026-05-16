/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_ChatSessionListResponse_ } from '../models/ApiResponse_ChatSessionListResponse_';
import type { ApiResponse_ChatSessionMessagesResponse_ } from '../models/ApiResponse_ChatSessionMessagesResponse_';
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { ApiResponse_SiteAnalyticsResponse_ } from '../models/ApiResponse_SiteAnalyticsResponse_';
import type { ApiResponse_SiteEEConfigFullResponse_ } from '../models/ApiResponse_SiteEEConfigFullResponse_';
import type { SiteEEConfigUpdate } from '../models/SiteEEConfigUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EeAdminSitesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Site Ee Config
     * 获取站点的企业版扩展配置
     * @returns ApiResponse_SiteEEConfigFullResponse_ Successful Response
     * @throws ApiError
     */
    public getAdminSiteEeConfig({
        siteId,
    }: {
        siteId: number,
    }): CancelablePromise<ApiResponse_SiteEEConfigFullResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/sites/{site_id}/ee-config',
            path: {
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Site Ee Config
     * 更新站点的企业版扩展配置
     * @returns ApiResponse_SiteEEConfigFullResponse_ Successful Response
     * @throws ApiError
     */
    public updateAdminSiteEeConfig({
        siteId,
        requestBody,
    }: {
        siteId: number,
        requestBody: SiteEEConfigUpdate,
    }): CancelablePromise<ApiResponse_SiteEEConfigFullResponse_> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/admin/v1/sites/{site_id}/ee-config',
            path: {
                'site_id': siteId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Analytics Overview
     * 获取站点数据分析概览（趋势+时段+热门+来源）
     * @returns ApiResponse_SiteAnalyticsResponse_ Successful Response
     * @throws ApiError
     */
    public eeAdminAnalyticsOverview({
        siteId,
        days = 7,
    }: {
        siteId: number,
        days?: number,
    }): CancelablePromise<ApiResponse_SiteAnalyticsResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/sites/{site_id}/analytics',
            path: {
                'site_id': siteId,
            },
            query: {
                'days': days,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Chat Sessions
     * 获取站点的 AI 对话会话列表 (审计用)
     * @returns ApiResponse_ChatSessionListResponse_ Successful Response
     * @throws ApiError
     */
    public eeAdminListChatSessions({
        siteId,
        keyword,
        searchField = 'all',
        source,
        page = 1,
        size = 20,
    }: {
        siteId: number,
        /**
         * 搜索关键词
         */
        keyword?: (string | null),
        /**
         * 搜索范围：all=全部，text=标题或最后消息，thread_id=会话ID，member_id=访客标识
         */
        searchField?: 'all' | 'text' | 'thread_id' | 'member_id',
        /**
         * 来源渠道过滤：web_chat/wecom_kefu/wecom_app/wecom_smart/dingtalk_app/feishu_app
         */
        source?: (string | null),
        page?: number,
        size?: number,
    }): CancelablePromise<ApiResponse_ChatSessionListResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/sites/{site_id}/chat-sessions',
            path: {
                'site_id': siteId,
            },
            query: {
                'keyword': keyword,
                'search_field': searchField,
                'source': source,
                'page': page,
                'size': size,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Chat Session Messages
     * 获取单个对话会话的完整聊天记录
     * @returns ApiResponse_ChatSessionMessagesResponse_ Successful Response
     * @throws ApiError
     */
    public eeAdminGetChatSessionMessages({
        siteId,
        threadId,
    }: {
        siteId: number,
        threadId: string,
    }): CancelablePromise<ApiResponse_ChatSessionMessagesResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/sites/{site_id}/chat-sessions/{thread_id}/messages',
            path: {
                'site_id': siteId,
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Chat Session
     * 删除指定的对话会话记录
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public eeAdminDeleteChatSession({
        siteId,
        threadId,
    }: {
        siteId: number,
        threadId: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/sites/{site_id}/chat-sessions/{thread_id}',
            path: {
                'site_id': siteId,
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
