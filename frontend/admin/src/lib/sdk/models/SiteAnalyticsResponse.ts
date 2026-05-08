/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DailyViewTrend } from './DailyViewTrend';
import type { HourlyDistribution } from './HourlyDistribution';
import type { RefererStat } from './RefererStat';
import type { RegionStat } from './RegionStat';
import type { TopDocument } from './TopDocument';
import type { VisitorStat } from './VisitorStat';
/**
 * 站点数据分析概览响应
 */
export type SiteAnalyticsResponse = {
    trends: Array<DailyViewTrend>;
    hourly_distribution: Array<HourlyDistribution>;
    top_documents: Array<TopDocument>;
    referer_stats: Array<RefererStat>;
    visitor_stats: Array<VisitorStat>;
    region_stats: Array<RegionStat>;
};

