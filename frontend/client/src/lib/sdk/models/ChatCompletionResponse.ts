/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatCompletionChoice } from './ChatCompletionChoice';
import type { ChatCompletionUsage } from './ChatCompletionUsage';
export type ChatCompletionResponse = {
    id: string;
    object?: string;
    created?: number;
    model: string;
    choices: Array<ChatCompletionChoice>;
    usage?: (ChatCompletionUsage | null);
};

