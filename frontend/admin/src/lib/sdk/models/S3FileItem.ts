/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * S3 文件/目录项
 */
export type S3FileItem = {
    /**
     * 文件或目录名（不含路径）
     */
    name: string;
    /**
     * 完整对象路径
     */
    path: string;
    /**
     * 类型: file | dir
     */
    type: S3FileItem.type;
    /**
     * 文件大小（字节），目录为 None
     */
    size?: (number | null);
    /**
     * 最后修改时间（ISO格式）
     */
    last_modified?: (string | null);
};
export namespace S3FileItem {
    /**
     * 类型: file | dir
     */
    export enum type {
        FILE = 'file',
        DIR = 'dir',
    }
}

