/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DocumentStatus } from './DocumentStatus';
import type { VectorStatus } from './VectorStatus';
/**
 * 更新文档
 */
export type DocumentUpdate = {
    title?: (string | null);
    content?: (string | null);
    summary?: (string | null);
    cover_image?: (string | null);
    collection_id?: (number | null);
    category?: (string | null);
    author?: (string | null);
    status?: (DocumentStatus | null);
    vector_status?: (VectorStatus | null);
    tags?: (Array<string> | null);
};

