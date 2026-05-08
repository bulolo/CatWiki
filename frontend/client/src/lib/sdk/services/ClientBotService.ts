/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ClientBotService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Verify Kefu Url
     * 验证回调 URL (企业微信客服设置时触发)
     * @returns any Successful Response
     * @throws ApiError
     */
    public verifyKefuUrlV1BotWecomKefuGet({
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
            url: '/v1/bot/wecom-kefu',
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
     * Handle Kefu Message
     * 处理企业微信客服消息回调 (XML 协议)
     * @returns any Successful Response
     * @throws ApiError
     */
    public handleKefuMessageV1BotWecomKefuPost({
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
            url: '/v1/bot/wecom-kefu',
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
     * Verify App Url
     * 验证回调 URL (企业微信机器人设置时触发)
     * @returns any Successful Response
     * @throws ApiError
     */
    public verifyAppUrlV1BotWecomAppGet({
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
            url: '/v1/bot/wecom-app',
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
     * Handle App Message
     * 处理企业微信机器人消息回调 (XML 协议)
     * @returns any Successful Response
     * @throws ApiError
     */
    public handleAppMessageV1BotWecomAppPost({
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
            url: '/v1/bot/wecom-app',
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
}
