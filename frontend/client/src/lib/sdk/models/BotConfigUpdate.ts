/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiBotConfig } from './ApiBotConfig';
import type { WebWidgetConfig } from './WebWidgetConfig';
import type { WechatBotConfig } from './WechatBotConfig';
/**
 * 更新机器人配置
 */
export type BotConfigUpdate = {
    webWidget: WebWidgetConfig;
    apiBot: ApiBotConfig;
    wechat: WechatBotConfig;
};

