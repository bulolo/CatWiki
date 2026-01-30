/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuickQuestion } from './QuickQuestion';
/**
 * 站点详情
 */
export type Site = {
    id: number;
    created_at: string;
    updated_at: string;
    /**
     * 站点名称
     */
    name: string;
    /**
     * 站点域名
     */
    domain?: (string | null);
    /**
     * 站点描述
     */
    description?: (string | null);
    /**
     * 图标名称
     */
    icon?: (string | null);
    /**
     * 状态: active, draft
     */
    status?: string;
    /**
     * 主题色
     */
    theme_color?: (string | null);
    /**
     * 布局模式: sidebar, top
     */
    layout_mode?: (string | null);
    /**
     * 快速问题配置
     */
    quick_questions?: (Array<QuickQuestion> | null);
    /**
     * 机器人配置
     */
    bot_config?: (Record<string, any> | null);
    /**
     * 文章数量
     */
    article_count?: number;
};

