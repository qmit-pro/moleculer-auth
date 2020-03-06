import { ClientAuthorizationState, ClientMetadata, InteractionResults } from "oidc-provider";
import { Identity } from "../../idp";
import { ProviderConfigBuilder } from "./config";
import { OIDCError } from "./error.types";
import { OIDCAccountClaims } from "./identity.types";
import { ApplicationRequestContext, ApplicationSessionPublicState, ApplicationMetadata, ApplicationRoutes, ApplicationSessionSecretState } from "./app.types";
import { Client, DeviceInfo, Interaction, Session } from "./proxy.types";
export declare class OIDCProviderContextProxy {
    private readonly ctx;
    private builder;
    session: Session;
    metadata: ApplicationMetadata;
    interaction?: Interaction;
    client?: Client;
    clientMetadata?: Partial<ClientMetadata>;
    user?: Identity;
    userClaims?: Partial<OIDCAccountClaims>;
    device?: DeviceInfo;
    constructor(ctx: ApplicationRequestContext, builder: ProviderConfigBuilder);
    private get idp();
    private get provider();
    get getURL(): (path: string, withHost?: true | undefined) => string;
    readonly getNamedURL: (name: string, opts?: any) => any;
    get routes(): ApplicationRoutes;
    render(name: string, error?: OIDCError, additionalRoutes?: ApplicationRoutes): Promise<void>;
    redirectWithUpdate(promptUpdate: Partial<InteractionResults> | {
        error: string;
        error_description?: string;
    }, allowedPromptNames?: string[]): Promise<void>;
    redirect(url: string): Promise<void>;
    end(): Promise<void>;
    get sessionPublicState(): any;
    get sessionSecretState(): any;
    setSessionPublicState(update: (prevPublicState: ApplicationSessionPublicState) => ApplicationSessionPublicState): Promise<void>;
    setSessionSecretState(update: (prevSecretState: ApplicationSessionSecretState) => ApplicationSessionSecretState): Promise<void>;
    private setSessionState;
    private ensureSessionSaved;
    private shouldSaveSession;
    private get isXHR();
    assertPrompt(allowedPromptNames?: string[]): void;
    getPublicClientProps(client?: Client): Promise<Partial<ClientMetadata> | undefined>;
    getPublicUserProps(id?: Identity): Promise<Partial<OIDCAccountClaims> | undefined>;
    getAuthorizedClientsProps(): Promise<(Partial<ClientMetadata> & {
        authorization: ClientAuthorizationState;
    })[] | undefined>;
    _dangerouslyCreate(): Promise<this>;
    private readProviderSession;
}
