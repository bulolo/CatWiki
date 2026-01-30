/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 移动合集请求
 */
export type MoveCollectionRequest = {
    /**
     * 目标父合集ID，null表示移到根级别
     */
    target_parent_id?: (number | null);
    /**
     * 目标位置索引，0表示第一个
     */
    target_position: number;
};

