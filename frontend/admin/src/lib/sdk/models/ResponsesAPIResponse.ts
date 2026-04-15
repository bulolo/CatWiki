/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatCompletionUsage } from './ChatCompletionUsage';
import type { ResponseOutputItem } from './ResponseOutputItem';
export type ResponsesAPIResponse = {
    id: string;
    object?: string;
    created_at?: number;
    status?: string;
    model: string;
    output: Array<ResponseOutputItem>;
    usage?: (ChatCompletionUsage | null);
};

