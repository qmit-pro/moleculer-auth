"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// need to hack oidc-provider private methods
// ref: https://github.com/panva/node-oidc-provider/blob/9306f66bdbcdff01400773f26539cf35951b9ce8/lib/models/client.js#L385
// @ts-ignore
const weak_cache_1 = tslib_1.__importDefault(require("oidc-provider/lib/helpers/weak_cache"));
// @ts-ignore
const session_1 = tslib_1.__importDefault(require("oidc-provider/lib/shared/session"));
const JSON = "application/json";
const HTML = "text/html";
const PUBLIC = "__public__";
const SECRET = "__secret__";
class OIDCProviderContextProxy {
    constructor(ctx, builder) {
        this.ctx = ctx;
        this.builder = builder;
        this.session = {}; // filled later
        this.metadata = {}; // filled later
        this.shouldSaveSession = false;
    }
    get idp() {
        return this.builder.app.idp;
    }
    get provider() {
        return this.builder.app.op;
    }
    get getURL() {
        return this.builder.app.getURL;
    }
    get getNamedURL() {
        return this.provider.urlFor;
    }
    get routes() {
        return this.builder.app.getRoutes(this.interaction && this.interaction.prompt && this.interaction.prompt.name);
    }
    // response methods
    async render(name, error, additionalRoutes) {
        await this.ensureSessionSaved();
        const { ctx } = this;
        // response { error: {} } when is XHR and stateProps has error
        if (this.isXHR && error) {
            const response = { error };
            ctx.type = JSON;
            ctx.body = response;
            return;
        }
        // else response { state: {...} }
        const state = {
            name,
            error,
            routes: {
                ...this.routes,
                ...additionalRoutes,
            },
            metadata: this.metadata,
            locale: ctx.locale,
            session: this.sessionPublicState,
            interaction: this.interaction,
            // current op interaction information (login, consent)
            client: this.clientMetadata,
            user: this.userClaims,
            device: this.device,
        };
        if (this.isXHR) {
            const response = { state };
            ctx.type = JSON;
            ctx.body = response;
            return;
        }
        // unwrap enhanced context to secure vulnerability, then delegate response to app renderer
        ctx.type = HTML;
        return this.builder.app.appRenderer.render(ctx.unwrap(), state);
    }
    async redirectWithUpdate(promptUpdate, allowedPromptNames) {
        await this.ensureSessionSaved();
        // finish interaction prompt
        const { ctx, interaction, provider } = this;
        ctx.assert(interaction && (!allowedPromptNames || allowedPromptNames.includes(interaction.prompt.name)));
        const mergedResult = { ...this.interaction.result, ...promptUpdate };
        const redirectURL = await provider.interactionResult(ctx.req, ctx.res, mergedResult, { mergeWithLastSubmission: true });
        // overwrite session account if need and re-parse interaction state
        if (mergedResult.login) {
            await provider.setProviderSession(ctx.req, ctx.res, mergedResult.login);
            await this.readProviderSession();
        }
        return this.redirect(redirectURL);
    }
    async redirect(url) {
        await this.ensureSessionSaved();
        const redirectURL = url.startsWith("/") ? this.getURL(url) : url; // add prefix for local redirection
        if (this.isXHR) {
            const response = { redirect: redirectURL };
            this.ctx.body = response;
            return;
        }
        this.ctx.redirect(redirectURL);
    }
    async end() {
        await this.ensureSessionSaved();
        const response = { session: this.sessionPublicState };
        this.ctx.type = JSON;
        this.ctx.body = response;
    }
    // session management
    get sessionPublicState() {
        return this.session.state && this.session.state[PUBLIC] || {};
    }
    get sessionSecretState() {
        return this.session.state && this.session.state[SECRET] || {};
    }
    async setSessionPublicState(update) {
        return this.setSessionState(prevState => ({
            ...prevState,
            [PUBLIC]: update(prevState[PUBLIC] || {}),
        }));
    }
    async setSessionSecretState(update) {
        return this.setSessionState(prevState => ({
            ...prevState,
            [SECRET]: update(prevState[SECRET] || {}),
        }));
    }
    async setSessionState(update) {
        this.session.state = update(this.session.state || {});
        this.shouldSaveSession = true;
    }
    async ensureSessionSaved() {
        if (this.shouldSaveSession) {
            await session_1.default(this.ctx, () => {
                // @ts-ignore to set Set-Cookie response header
                session.touched = true;
            });
            // @ts-ignore store/update session in to adapter
            await session.save();
        }
    }
    // utility methods
    get isXHR() {
        return this.ctx.accepts(JSON, HTML) === JSON;
    }
    assertPrompt(allowedPromptNames) {
        const { ctx, interaction } = this;
        ctx.assert(interaction && (!allowedPromptNames || allowedPromptNames.includes(interaction.prompt.name)));
    }
    async getPublicClientProps(client) {
        if (!client)
            return;
        return {
            id: client.clientId,
            name: client.clientName,
            logo_uri: client.logoUri,
            tos_uri: client.tosUri,
            policy_uri: client.policyUri,
            client_uri: client.clientUri,
        };
    }
    async getPublicUserProps(id) {
        if (!id)
            return;
        const { email, picture, name } = await id.claims("userinfo", "profile email");
        return {
            email,
            name: name || "unknown",
            picture,
        };
    }
    // parse metadata and collect information
    async _dangerouslyCreate() {
        const { ctx, idp, provider } = this;
        const hiddenProvider = weak_cache_1.default(provider);
        // @ts-ignore ensure oidc context is created
        if (!ctx.oidc) {
            Object.defineProperty(ctx, "oidc", { value: new hiddenProvider.OIDCContext(ctx) });
        }
        const configuration = hiddenProvider.configuration();
        this.session = await provider.Session.get(ctx);
        this.metadata = {
            federationProviders: this.builder.app.federation.providerNames,
            mandatoryScopes: idp.claims.mandatoryScopes,
            supportedScopes: idp.claims.supportedScopes,
            discovery: configuration.discovery,
        };
        await this.readProviderSession();
        return this;
    }
    async readProviderSession() {
        const { ctx, idp, provider } = this;
        try {
            const interaction = await provider.interactionDetails(ctx.req, ctx.res);
            this.interaction = interaction;
            this.user = interaction.session && typeof interaction.session.accountId === "string" ? (await idp.findOrFail({ id: interaction.session.accountId })) : undefined;
            if (this.user) {
                this.userClaims = await this.getPublicUserProps(this.user);
            }
            this.client = interaction.params.client_id ? await provider.Client.find(interaction.params.client_id) : undefined;
            if (this.client) {
                this.clientMetadata = await this.getPublicClientProps(this.client);
            }
        }
        catch (err) { }
    }
}
exports.OIDCProviderContextProxy = OIDCProviderContextProxy;
//# sourceMappingURL=context.js.map