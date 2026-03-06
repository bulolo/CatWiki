/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuickQuestion } from './QuickQuestion';
/**
 * 客户端展示用的站点信息 (精简版)
 */
export type ClientSite = {
    id: number;
    name: string;
    slug: string;
    description?: (string | null);
    icon?: (string | null);
    article_count?: number;
    tenant_id?: (number | null);
    tenant_slug?: (string | null);
    theme_color?: (string | null);
    layout_mode?: (string | null);
    quick_questions?: (Array<QuickQuestion> | null);
    web_widget?: (Record<string, any> | null);
};

