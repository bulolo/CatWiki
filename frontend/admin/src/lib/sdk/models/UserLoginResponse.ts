/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserResponse } from './UserResponse';
/**
 * 用户登录响应
 */
export type UserLoginResponse = {
    /**
     * 访问令牌
     */
    token: string;
    /**
     * 用户信息
     */
    user: UserResponse;
};

