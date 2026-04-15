/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TenantCreateRequest = {
    max_sites?: number;
    max_documents?: number;
    max_storage_mb?: number;
    max_users?: number;
    plan?: string;
    platform_resources_allowed?: Array<string>;
    contact_email?: (string | null);
    contact_phone?: (string | null);
    advanced_config?: Record<string, any>;
    plan_expires_at?: (string | null);
    name: string;
    slug: string;
    domain?: (string | null);
    logo_url?: (string | null);
    description?: (string | null);
    status?: string;
    admin_email: string;
    admin_password: string;
    admin_name?: (string | null);
};

