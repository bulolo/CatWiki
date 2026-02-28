/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 单个模型配置
 */
export type ModelConfig = {
  /**
   * 模型提供商
   */
  provider: string;
  /**
   * 模型名称
   */
  model: string;
  /**
   * API Key
   */
  api_key: string;
  /**
   * API Base URL
   */
  base_url: string;
  /**
   * Embedding 维度 (自动探测)
   */
  dimension?: (number | null);
  /**
   * 配置模式: custom=自定义, platform=使用平台资源
   */
  mode?: ModelConfig.mode;
  /**
   * 是否支持视觉/多模态
   */
  is_vision?: boolean;
  /**
   * 额外请求体参数 (例如: {"chat_template_kwargs": {"enable_thinking": false}})
   */
  extra_body?: (Record<string, any> | null);
};
export namespace ModelConfig {
  /**
   * 配置模式: custom=自定义, platform=使用平台资源
   */
  export enum mode {
    CUSTOM = 'custom',
    PLATFORM = 'platform',
  }
}

