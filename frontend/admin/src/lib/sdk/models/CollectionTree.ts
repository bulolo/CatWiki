/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 合集树形结构
 */
export type CollectionTree = {
    id: number;
    title: string;
    type?: string;
    children?: (Array<CollectionTree> | null);
    status?: (string | null);
    views?: (number | null);
    tags?: (Array<string> | null);
    collection_id?: (number | null);
};

