/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiBotConfigResponse } from './ApiBotConfigResponse';
import type { SiteEEConfigResponse } from './SiteEEConfigResponse';
/**
 * 统一站点 EE 配置响应
 */
export type SiteEEConfigFullResponse = {
    site_id: number;
    access: SiteEEConfigResponse;
    api_bot: ApiBotConfigResponse;
};

