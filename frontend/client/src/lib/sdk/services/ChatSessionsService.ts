/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse_ChatSessionListResponse_ } from '../models/ApiResponse_ChatSessionListResponse_';
import type { ApiResponse_ChatSessionMessagesResponse_ } from '../models/ApiResponse_ChatSessionMessagesResponse_';
import type { ApiResponse_ChatSessionResponse_ } from '../models/ApiResponse_ChatSessionResponse_';
import type { ApiResponse_dict_ } from '../models/ApiResponse_dict_';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ChatSessionsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Sessions
     * 获取会话列表
     *
     * 支持按租户、站点和会员过滤，支持关键词搜索，按更新时间倒序排列。
     * @returns ApiResponse_ChatSessionListResponse_ Successful Response
     * @throws ApiError
     */
    public listChatSessions({
        siteId,
        memberId,
        keyword,
        page = 1,
        size = 20,
        isPager = 1,
        tenantId,
    }: {
        /**
         * 站点ID过滤
         */
        siteId?: (number | null),
        /**
         * 会员ID或访客ID过滤
         */
        memberId?: (string | null),
        /**
         * 搜索关键词（匹配标题或最后消息）
         */
        keyword?: (string | null),
        /**
         * 页码
         */
        page?: number,
        /**
         * 每页数量
         */
        size?: number,
        /**
         * 是否分页，0=返回全部，1=分页
         */
        isPager?: number,
        /**
         * 租户ID
         */
        tenantId?: (number | null),
    }): CancelablePromise<ApiResponse_ChatSessionListResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/chat/sessions',
            query: {
                'site_id': siteId,
                'member_id': memberId,
                'keyword': keyword,
                'page': page,
                'size': size,
                'is_pager': isPager,
                'tenant_id': tenantId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Session
     * 获取会话详情
     *
     * 返回会话元数据。如需获取完整消息历史，请调用 /chat/responses 或使用 LangGraph API。
     * @returns ApiResponse_ChatSessionResponse_ Successful Response
     * @throws ApiError
     */
    public getChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ApiResponse_ChatSessionResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/chat/sessions/{thread_id}',
            path: {
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Session
     * 删除会话
     *
     * 删除会话元数据记录，并同步删除 LangGraph Checkpointer 中的消息历史。
     * @returns ApiResponse_dict_ Successful Response
     * @throws ApiError
     */
    public deleteChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ApiResponse_dict_> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/v1/chat/sessions/{thread_id}',
            path: {
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Session Messages
     * 获取单个会话的完整聊天历史信息
     *
     * 从数据库全量历史表中读取所有消息。
     * @returns ApiResponse_ChatSessionMessagesResponse_ Successful Response
     * @throws ApiError
     */
    public getChatSessionMessages({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ApiResponse_ChatSessionMessagesResponse_> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/chat/sessions/{thread_id}/messages',
            path: {
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
