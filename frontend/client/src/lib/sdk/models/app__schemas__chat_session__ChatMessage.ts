/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 单条消息模型（OpenAI 格式）
 */
export type app__schemas__chat_session__ChatMessage = {
    /**
     * 角色: user/assistant/system
     */
    role: string;
    /**
     * 内容，tool_call 时可能为空
     */
    content?: (string | null);
    /**
     * 消息ID
     */
    id?: (string | null);
    /**
     * 工具调用列表
     */
    tool_calls?: null;
    /**
     * 工具调用ID（role=tool时）
     */
    tool_call_id?: (string | null);
};

