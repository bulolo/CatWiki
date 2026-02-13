/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatCompletionRequest } from '../models/ChatCompletionRequest';
import type { ChatCompletionResponse } from '../models/ChatCompletionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class BotsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Verify Url
     * 验证回调 URL (企业微信设置时触发)
     * @returns any Successful Response
     * @throws ApiError
     */
    public verifyUrlV1BotWecomSmartRobotGet({
        msgSignature,
        timestamp,
        nonce,
        echostr,
        siteId,
    }: {
        msgSignature: string,
        timestamp: string,
        nonce: string,
        echostr: string,
        siteId: number,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/bot/wecom-smart-robot',
            query: {
                'msg_signature': msgSignature,
                'timestamp': timestamp,
                'nonce': nonce,
                'echostr': echostr,
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Handle Message
     * 处理企业微信消息回调
     * @returns any Successful Response
     * @throws ApiError
     */
    public handleMessageV1BotWecomSmartRobotPost({
        msgSignature,
        timestamp,
        nonce,
        siteId,
    }: {
        msgSignature: string,
        timestamp: string,
        nonce: string,
        siteId: number,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/bot/wecom-smart-robot',
            query: {
                'msg_signature': msgSignature,
                'timestamp': timestamp,
                'nonce': nonce,
                'site_id': siteId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Site Chat Completion
     * 创建聊天补全 (专用接口，兼容 OpenAI 格式)
     * @returns ChatCompletionResponse Successful Response
     * @throws ApiError
     */
    public createSiteChatCompletion({
        authorization,
        requestBody,
    }: {
        /**
         * Bearer <api_key>
         */
        authorization: string,
        requestBody: ChatCompletionRequest,
    }): CancelablePromise<ChatCompletionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/bot/site-completions',
            headers: {
                'authorization': authorization,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
