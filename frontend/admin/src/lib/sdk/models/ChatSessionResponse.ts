/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 会话响应模型
 */
export type ChatSessionResponse = {
    /**
     * 会话 thread_id
     */
    thread_id: string;
    /**
     * 站点ID
     */
    site_id: number;
    /**
     * 会员ID
     */
    member_id?: (number | null);
    /**
     * 会话标题
     */
    title?: (string | null);
    id: number;
    /**
     * 最后消息预览
     */
    last_message?: (string | null);
    /**
     * 最后消息角色
     */
    last_message_role?: (string | null);
    /**
     * 消息数量
     */
    message_count?: number;
    created_at: string;
    updated_at: string;
};

