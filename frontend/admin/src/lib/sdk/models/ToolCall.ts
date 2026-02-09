/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FunctionCall } from './FunctionCall';
/**
 * OpenAI 兼容的工具调用定义
 */
export type ToolCall = {
    id: string;
    type?: string;
    function: FunctionCall;
};

