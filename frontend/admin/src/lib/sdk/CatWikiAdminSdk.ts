/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { AdminCacheService } from './services/AdminCacheService';
import { AdminCollectionsService } from './services/AdminCollectionsService';
import { AdminDocumentsService } from './services/AdminDocumentsService';
import { AdminFilesService } from './services/AdminFilesService';
import { AdminHealthService } from './services/AdminHealthService';
import { AdminSitesService } from './services/AdminSitesService';
import { AdminStatsService } from './services/AdminStatsService';
import { AdminSystemConfigsService } from './services/AdminSystemConfigsService';
import { AdminTasksService } from './services/AdminTasksService';
import { AdminTenantsService } from './services/AdminTenantsService';
import { AdminUsersService } from './services/AdminUsersService';
import { EeAdminApiBotService } from './services/EeAdminApiBotService';
import { EeAdminSiteAccessService } from './services/EeAdminSiteAccessService';
import { EeAdminTenantsService } from './services/EeAdminTenantsService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class CatWikiAdminSdk {
    public readonly adminCache: AdminCacheService;
    public readonly adminCollections: AdminCollectionsService;
    public readonly adminDocuments: AdminDocumentsService;
    public readonly adminFiles: AdminFilesService;
    public readonly adminHealth: AdminHealthService;
    public readonly adminSites: AdminSitesService;
    public readonly adminStats: AdminStatsService;
    public readonly adminSystemConfigs: AdminSystemConfigsService;
    public readonly adminTasks: AdminTasksService;
    public readonly adminTenants: AdminTenantsService;
    public readonly adminUsers: AdminUsersService;
    public readonly eeAdminApiBot: EeAdminApiBotService;
    public readonly eeAdminSiteAccess: EeAdminSiteAccessService;
    public readonly eeAdminTenants: EeAdminTenantsService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '1.0.8',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.adminCache = new AdminCacheService(this.request);
        this.adminCollections = new AdminCollectionsService(this.request);
        this.adminDocuments = new AdminDocumentsService(this.request);
        this.adminFiles = new AdminFilesService(this.request);
        this.adminHealth = new AdminHealthService(this.request);
        this.adminSites = new AdminSitesService(this.request);
        this.adminStats = new AdminStatsService(this.request);
        this.adminSystemConfigs = new AdminSystemConfigsService(this.request);
        this.adminTasks = new AdminTasksService(this.request);
        this.adminTenants = new AdminTenantsService(this.request);
        this.adminUsers = new AdminUsersService(this.request);
        this.eeAdminApiBot = new EeAdminApiBotService(this.request);
        this.eeAdminSiteAccess = new EeAdminSiteAccessService(this.request);
        this.eeAdminTenants = new EeAdminTenantsService(this.request);
    }
}

