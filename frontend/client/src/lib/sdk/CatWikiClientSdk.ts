/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { BotsService } from './services/BotsService';
import { ChatService } from './services/ChatService';
import { ChatSessionsService } from './services/ChatSessionsService';
import { CollectionsService } from './services/CollectionsService';
import { DocumentsService } from './services/DocumentsService';
import { FilesService } from './services/FilesService';
import { HealthService } from './services/HealthService';
import { SitesService } from './services/SitesService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class CatWikiClientSdk {
    public readonly bots: BotsService;
    public readonly chat: ChatService;
    public readonly chatSessions: ChatSessionsService;
    public readonly collections: CollectionsService;
    public readonly documents: DocumentsService;
    public readonly files: FilesService;
    public readonly health: HealthService;
    public readonly sites: SitesService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '0.0.4',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.bots = new BotsService(this.request);
        this.chat = new ChatService(this.request);
        this.chatSessions = new ChatSessionsService(this.request);
        this.collections = new CollectionsService(this.request);
        this.documents = new DocumentsService(this.request);
        this.files = new FilesService(this.request);
        this.health = new HealthService(this.request);
        this.sites = new SitesService(this.request);
    }
}

