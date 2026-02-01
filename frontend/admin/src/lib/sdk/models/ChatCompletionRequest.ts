/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { VectorRetrieveFilter } from './VectorRetrieveFilter';
export type ChatCompletionRequest = {
    model?: string;
    message: string;
    thread_id: string;
    temperature?: (number | null);
    top_p?: (number | null);
    'n'?: (number | null);
    stream?: (boolean | null);
    stop?: (string | Array<string> | null);
    max_tokens?: (number | null);
    presence_penalty?: (number | null);
    frequency_penalty?: (number | null);
    logit_bias?: (Record<string, number> | null);
    user?: (string | null);
    filter?: (VectorRetrieveFilter | null);
};

