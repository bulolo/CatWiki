/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatCompletionRequest } from '../models/ChatCompletionRequest';
import type { ModelList } from '../models/ModelList';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class BotService {
  constructor(public readonly httpRequest: BaseHttpRequest) { }
  /**
   * Verify Url
   * 验证回调 URL (企业微信智能机器人设置时触发)
   * @returns any Successful Response
   * @throws ApiError
   */
  public verifyUrlV1BotWecomSmartRobotGet({
    msgSignature,
    timestamp,
    nonce,
    echostr,
    siteId,
    xTenantSlug,
  }: {
    msgSignature: string,
    timestamp: string,
    nonce: string,
    echostr: string,
    siteId: number,
    xTenantSlug?: (string | null),
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/v1/bot/wecom-smart-robot',
      headers: {
        'X-Tenant-Slug': xTenantSlug,
      },
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
   * Handle Wecom Message
   * 处理企业微信智能机器人消息回调 (JSON 协议)
   * @returns any Successful Response
   * @throws ApiError
   */
  public handleWecomMessageV1BotWecomSmartRobotPost({
    msgSignature,
    timestamp,
    nonce,
    siteId,
    xTenantSlug,
  }: {
    msgSignature: string,
    timestamp: string,
    nonce: string,
    siteId: number,
    xTenantSlug?: (string | null),
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/v1/bot/wecom-smart-robot',
      headers: {
        'X-Tenant-Slug': xTenantSlug,
      },
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
    xTenantSlug,
  }: {
    msgSignature: string,
    timestamp: string,
    nonce: string,
    echostr: string,
    siteId: number,
    xTenantSlug?: (string | null),
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/v1/bot/wecom-kefu',
      headers: {
        'X-Tenant-Slug': xTenantSlug,
      },
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
    xTenantSlug,
  }: {
    msgSignature: string,
    timestamp: string,
    nonce: string,
    siteId: number,
    xTenantSlug?: (string | null),
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/v1/bot/wecom-kefu',
      headers: {
        'X-Tenant-Slug': xTenantSlug,
      },
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
   * [企业版专属功能]
   * @returns any Successful Response
   * @throws ApiError
   */
  public createSiteChatCompletionV1BotChatCompletionsPost({
    authorization,
    requestBody,
    siteId,
  }: {
    /**
     * Bearer <api_key>
     */
    authorization: string,
    requestBody: ChatCompletionRequest,
    siteId?: (number | null),
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/v1/bot/chat/completions',
      headers: {
        'authorization': authorization,
      },
      query: {
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
   * List Models
   * 列出可用的模型 (兼容 OpenAI 格式)
   * @returns ModelList Successful Response
   * @throws ApiError
   */
  public listModelsV1BotModelsGet({
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
