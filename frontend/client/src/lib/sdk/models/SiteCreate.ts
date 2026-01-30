/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuickQuestion } from './QuickQuestion';
/**
 * 创建站点
 */
export type SiteCreate = {
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
     * 管理员邮箱
     */
    admin_email?: (string | null);
    /**
     * 管理员姓名
     */
    admin_name?: (string | null);
    /**
     * 管理员密码
     */
    admin_password?: (string | null);
};

