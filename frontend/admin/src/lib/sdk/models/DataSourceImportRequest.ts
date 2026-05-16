/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 从数据源导入文件请求
 */
export type DataSourceImportRequest = {
    /**
     * 要导入的 S3 对象路径列表
     */
    keys: Array<string>;
    /**
     * 目标站点ID
     */
    site_id: number;
    /**
     * 目标合集ID
     */
    collection_id: number;
    /**
     * 解析器类型
     */
    processor_type?: string;
    /**
     * 是否启用OCR
     */
    ocr_enabled?: boolean;
    /**
     * 是否提取图片
     */
    extract_images?: boolean;
    /**
     * 是否提取表格
     */
    extract_tables?: boolean;
    /**
     * 重复文件策略: skip | allow
     */
    duplicate_strategy?: string;
    /**
     * 是否AI生成摘要
     */
    generate_summary?: boolean;
    /**
     * 是否AI生成标签
     */
    generate_tags?: boolean;
    /**
     * 解析完成后是否自动入向量库
     */
    auto_vectorize?: boolean;
};

