/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatSessionListResponse } from '../models/ChatSessionListResponse';
import type { ChatSessionResponse } from '../models/ChatSessionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ChatSessionsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Sessions
     * 获取会话列表
     *
     * 支持按站点和会员过滤，按更新时间倒序排列。
     * @returns ChatSessionListResponse Successful Response
     * @throws ApiError
     */
    public listChatSessions({
        siteId,
        memberId,
        page = 1,
        size = 20,
    }: {
        /**
         * 站点ID过滤
         */
        siteId?: (number | null),
        /**
         * 会员ID过滤
         */
        memberId?: (number | null),
        /**
         * 页码
         */
        page?: number,
        /**
         * 每页数量
         */
        size?: number,
    }): CancelablePromise<ChatSessionListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/chat/sessions',
            query: {
                'site_id': siteId,
                'member_id': memberId,
                'page': page,
                'size': size,
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
     * 返回会话元数据。如需获取完整消息历史，请调用 /chat/completions 或使用 LangGraph API。
     * @returns ChatSessionResponse Successful Response
     * @throws ApiError
     */
    public getChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ChatSessionResponse> {
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
     * 删除会话元数据记录。注意：这不会删除 Checkpointer 中的消息历史。
     * @returns any Successful Response
     * @throws ApiError
     */
    public deleteChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<Record<string, any>> {
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
}
