/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AutoModeConfig } from './AutoModeConfig';
import type { ManualModeConfig } from './ManualModeConfig';
/**
 * 更新 AI 配置
 */
export type AIConfigUpdate = {
    /**
     * 配置模式
     */
    mode: AIConfigUpdate.mode;
    autoConfig: AutoModeConfig;
    manualConfig: ManualModeConfig;
};
export namespace AIConfigUpdate {
    /**
     * 配置模式
     */
    export enum mode {
        AUTO = 'auto',
        MANUAL = 'manual',
    }
}

