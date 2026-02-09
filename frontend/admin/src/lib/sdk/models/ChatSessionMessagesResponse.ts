/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { app__schemas__chat_session__ChatMessage } from './app__schemas__chat_session__ChatMessage';
/**
 * 会话详细消息列表响应
 */
export type ChatSessionMessagesResponse = {
    thread_id: string;
    messages: Array<app__schemas__chat_session__ChatMessage>;
    /**
     * 引用来源列表
     */
    citations?: null;
};

