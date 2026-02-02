/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { app__api__admin__endpoints__chat_sessions__ChatMessage } from './app__api__admin__endpoints__chat_sessions__ChatMessage';
/**
 * 会话消息列表响应
 */
export type ChatSessionMessagesResponse = {
    thread_id: string;
    messages: Array<app__api__admin__endpoints__chat_sessions__ChatMessage>;
    total: number;
};

