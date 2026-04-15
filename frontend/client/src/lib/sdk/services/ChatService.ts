/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ResponsesAPIRequest } from '../models/ResponsesAPIRequest';
import type { ResponsesAPIResponse } from '../models/ResponsesAPIResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ChatService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Response
     * 创建 AI 响应（标准 OpenAI Responses API，含 CatWiki 扩展字段 filter）
     * @returns ResponsesAPIResponse Successful Response
     * @throws ApiError
     */
    public createResponse({
        requestBody,
    }: {
        requestBody: ResponsesAPIRequest,
    }): CancelablePromise<ResponsesAPIResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/chat/responses',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
