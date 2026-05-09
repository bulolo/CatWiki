/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { ClientBotService } from './services/ClientBotService';
import { ClientChatService } from './services/ClientChatService';
import { ClientChatSessionsService } from './services/ClientChatSessionsService';
import { ClientCollectionsService } from './services/ClientCollectionsService';
import { ClientDocumentsService } from './services/ClientDocumentsService';
import { ClientFilesService } from './services/ClientFilesService';
import { ClientHealthService } from './services/ClientHealthService';
import { ClientSitesService } from './services/ClientSitesService';
import { EeClientBotService } from './services/EeClientBotService';
import { EeClientSitesService } from './services/EeClientSitesService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class CatWikiClientSdk {
    public readonly clientBot: ClientBotService;
    public readonly clientChat: ClientChatService;
    public readonly clientChatSessions: ClientChatSessionsService;
    public readonly clientCollections: ClientCollectionsService;
    public readonly clientDocuments: ClientDocumentsService;
    public readonly clientFiles: ClientFilesService;
    public readonly clientHealth: ClientHealthService;
    public readonly clientSites: ClientSitesService;
    public readonly eeClientBot: EeClientBotService;
    public readonly eeClientSites: EeClientSitesService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '1.1.1',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.clientBot = new ClientBotService(this.request);
        this.clientChat = new ClientChatService(this.request);
        this.clientChatSessions = new ClientChatSessionsService(this.request);
        this.clientCollections = new ClientCollectionsService(this.request);
        this.clientDocuments = new ClientDocumentsService(this.request);
        this.clientFiles = new ClientFilesService(this.request);
        this.clientHealth = new ClientHealthService(this.request);
        this.clientSites = new ClientSitesService(this.request);
        this.eeClientBot = new EeClientBotService(this.request);
        this.eeClientSites = new EeClientSitesService(this.request);
    }
}

