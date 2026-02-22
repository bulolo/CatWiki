/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TenantSchema = {
    name: string;
    slug: string;
    domain?: (string | null);
    logo_url?: (string | null);
    description?: (string | null);
    status?: string;
    max_sites?: number;
    max_documents?: number;
    max_storage_mb?: number;
    max_users?: number;
    plan?: string;
    platform_resources_allowed?: Array<string>;
    contact_email?: (string | null);
    contact_phone?: (string | null);
    id: number;
    created_at: string;
    updated_at: string;
    plan_expires_at: string;
    /**
     * 是否为演示模式
     */
    readonly is_demo: boolean;
};

