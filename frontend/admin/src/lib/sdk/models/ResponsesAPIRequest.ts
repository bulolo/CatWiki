/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { app__schemas__chat__ChatMessage } from './app__schemas__chat__ChatMessage';
import type { VectorRetrieveFilter } from './VectorRetrieveFilter';
/**
 * 标准 OpenAI Responses API 请求（含 CatWiki 扩展字段）
 */
export type ResponsesAPIRequest = {
    model?: (string | null);
    input: (string | Array<app__schemas__chat__ChatMessage>);
    instructions?: (string | null);
    previous_response_id?: (string | null);
    stream?: (boolean | null);
    temperature?: (number | null);
    max_output_tokens?: (number | null);
    user?: (string | null);
    filter?: (VectorRetrieveFilter | null);
};

