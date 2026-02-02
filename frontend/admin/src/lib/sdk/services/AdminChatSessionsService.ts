/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatSessionListResponse } from '../models/ChatSessionListResponse';
import type { ChatSessionMessagesResponse } from '../models/ChatSessionMessagesResponse';
import type { ChatSessionResponse } from '../models/ChatSessionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminChatSessionsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Sessions
     * 获取会话列表
     * @returns ChatSessionListResponse Successful Response
     * @throws ApiError
     */
    public adminListChatSessions({
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
            url: '/admin/v1/chat/sessions',
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
     * @returns ChatSessionResponse Successful Response
     * @throws ApiError
     */
    public adminGetChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ChatSessionResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/chat/sessions/{thread_id}',
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
     * @returns any Successful Response
     * @throws ApiError
     */
    public adminDeleteChatSession({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<Record<string, any>> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/admin/v1/chat/sessions/{thread_id}',
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
     * 获取会话的消息历史
     * @returns ChatSessionMessagesResponse Successful Response
     * @throws ApiError
     */
    public adminGetChatMessages({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<ChatSessionMessagesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/admin/v1/chat/sessions/{thread_id}/messages',
            path: {
                'thread_id': threadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
