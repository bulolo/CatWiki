/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RecentSession } from './RecentSession';
import type { TrendData } from './TrendData';
/**
 * 站点统计数据
 */
export type SiteStats = {
    /**
     * 文档总数
     */
    total_documents: number;
    /**
     * 总访问次数
     */
    total_views: number;
    /**
     * 今日浏览量
     */
    views_today?: number;
    /**
     * 今日独立IP数
     */
    unique_ips_today?: number;
    /**
     * AI会话总数
     */
    total_chat_sessions?: number;
    /**
     * AI消息总数
     */
    total_chat_messages?: number;
    /**
     * 活跃AI用户数
     */
    active_chat_users?: number;
    /**
     * 今日新增会话
     */
    new_sessions_today?: number;
    /**
     * 今日新增消息
     */
    new_messages_today?: number;
    /**
     * 最近7天趋势
     */
    daily_trends?: Array<TrendData>;
    /**
     * 最近对话记录
     */
    recent_sessions?: Array<RecentSession>;
};

