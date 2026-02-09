/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ToolCall } from './ToolCall';
/**
 * OpenAI 兼容的聊天消息
 */
export type app__schemas__chat__ChatMessage = {
    role: string;
    content?: (string | null);
    name?: (string | null);
    tool_calls?: (Array<ToolCall> | null);
    tool_call_id?: (string | null);
};

