/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DocProcessorType } from './DocProcessorType';
export type Body_importDocument = {
    file: Blob;
    site_id: number;
    collection_id: number;
    processor_type?: DocProcessorType;
    ocr_enabled?: boolean;
    extract_images?: boolean;
    extract_tables?: boolean;
    duplicate_strategy?: string;
    generate_summary?: boolean;
    generate_tags?: boolean;
    auto_vectorize?: boolean;
};

