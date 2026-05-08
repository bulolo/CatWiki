/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelList } from '../models/ModelList';
import type { OpenAIChatCompletionRequest } from '../models/OpenAIChatCompletionRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EeClientBotService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Site Chat Completion
     * 创建聊天补全 (专用接口，兼容 OpenAI 格式)
     * [企业版专属功能]
     * @returns any Successful Response
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
        requestBody: OpenAIChatCompletionRequest,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/bot/chat/completions',
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
    /**
     * List Models
     * 列出可用的模型 (兼容 OpenAI 格式)
     * @returns ModelList Successful Response
     * @throws ApiError
     */
    public listEeClientBotModels({
        authorization,
    }: {
        /**
         * Bearer <api_key>
         */
        authorization?: (string | null),
    }): CancelablePromise<ModelList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/bot/models',
            headers: {
                'authorization': authorization,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
