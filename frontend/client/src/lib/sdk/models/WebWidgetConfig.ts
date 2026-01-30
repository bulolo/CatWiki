/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 网页挂件配置
 */
export type WebWidgetConfig = {
    /**
     * 是否启用
     */
    enabled?: boolean;
    /**
     * 挂件标题
     */
    title?: string;
    /**
     * 欢迎语
     */
    welcomeMessage?: string;
    /**
     * 主题色
     */
    primaryColor?: string;
    /**
     * 显示位置
     */
    position?: WebWidgetConfig.position;
};
export namespace WebWidgetConfig {
    /**
     * 显示位置
     */
    export enum position {
        LEFT = 'left',
        RIGHT = 'right',
    }
}

