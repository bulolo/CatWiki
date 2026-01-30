/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatCompletionRequest } from '../models/ChatCompletionRequest';
import type { ChatCompletionResponse } from '../models/ChatCompletionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ChatService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Chat Completion
     * 创建聊天补全 (OpenAI 兼容接口)
     * 对接真实 AI 服务
     * @returns ChatCompletionResponse Successful Response
     * @throws ApiError
     */
    public createChatCompletion({
        requestBody,
    }: {
        requestBody: ChatCompletionRequest,
    }): CancelablePromise<ChatCompletionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/chat/completions',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
