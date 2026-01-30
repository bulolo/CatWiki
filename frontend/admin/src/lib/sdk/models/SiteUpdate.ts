/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuickQuestion } from './QuickQuestion';
/**
 * 更新站点
 */
export type SiteUpdate = {
    name?: (string | null);
    domain?: (string | null);
    description?: (string | null);
    icon?: (string | null);
    status?: (string | null);
    theme_color?: (string | null);
    layout_mode?: (string | null);
    /**
     * 快速问题配置
     */
    quick_questions?: (Array<QuickQuestion> | null);
    /**
     * 机器人配置
     */
    bot_config?: (Record<string, any> | null);
};

