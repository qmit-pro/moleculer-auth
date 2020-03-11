"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const koa_bodyparser_1 = tslib_1.__importDefault(require("koa-bodyparser"));
const koa_compose_1 = tslib_1.__importDefault(require("koa-compose"));
const koa_router_1 = tslib_1.__importDefault(require("koa-router"));
const koajs_nocache_1 = tslib_1.__importDefault(require("koajs-nocache"));
const change_case_1 = require("change-case");
const idp_1 = require("../../idp");
const context_1 = require("./context");
const federation_1 = require("./federation");
const i18n_1 = require("../../helper/i18n");
const renderer_1 = require("./renderer");
class ProviderApplicationBuilder {
    constructor(builder) {
        this.builder = builder;
        this._prefix = "/op";
        this.getURL = (path, withHost) => `${withHost ? this.builder.issuer : ""}${this.prefix}${path}`;
        this.wrapContext = async (ctx, next) => {
            ctx.idp = this.idp;
            ctx.op = await new context_1.OIDCProviderContextProxy(ctx, this.builder)._dangerouslyCreate();
            ctx.unwrap = () => {
                delete ctx.idp;
                delete ctx.op;
                delete ctx.locale;
                return ctx;
            };
            return next();
        };
        this.errorHandler = async (ctx, next) => {
            try {
                await next();
            }
            catch (err) {
                this.logger.error("app error", err);
                // normalize and translate error
                const { error, name, message, status, statusCode, code, status_code, error_description, expose, ...otherProps } = err;
                // set status
                let normalizedStatus = status || statusCode || code || status_code || 500;
                if (isNaN(normalizedStatus))
                    normalizedStatus = 500;
                ctx.status = normalizedStatus;
                const normalizedError = this.translateError(ctx, {
                    error: change_case_1.pascalCase(error || name || "UnexpectedError"),
                    error_description: error_description || message || "Unexpected error.",
                    ...((expose || this.builder.dev) ? otherProps : {}),
                });
                return ctx.op.render("error", normalizedError);
            }
        };
        this.routerMiddleware = koa_compose_1.default([
            koajs_nocache_1.default(),
            koa_bodyparser_1.default(),
            this.wrapContext,
            this.errorHandler,
        ]);
        // internally named routes render default functions
        // ref: https://github.com/panva/node-oidc-provider/blob/74b434c627248c82ca9db5aed3a03f0acd0d7214/lib/shared/error_handler.js#L47
        this.renderErrorProxy = (ctx, out, error) => {
            return this.wrapContext(ctx, () => {
                return this.errorHandler(ctx, () => {
                    throw error;
                });
            });
        };
        this.renderLogout = async (ctx, xsrf) => {
            return ctx.op.render("logout", undefined, {
                // destroy sessions
                "logout.confirm": {
                    url: ctx.op.getNamedURL("end_session_confirm"),
                    method: "POST",
                    payload: {
                        xsrf,
                        logout: "true",
                    },
                    synchronous: true,
                },
                // without session destroy
                "logout.redirect": {
                    url: ctx.op.getNamedURL("end_session_confirm"),
                    method: "POST",
                    payload: {
                        xsrf,
                    },
                    synchronous: true,
                },
            });
        };
        // ref: https://github.com/panva/node-oidc-provider/blob/e5ecd85c346761f1ac7a89b8bf174b873be09239/lib/actions/end_session.js#L89
        this.logoutSourceProxy = (ctx) => {
            return this.wrapContext(ctx, () => {
                const op = ctx.op;
                ctx.assert(op.user);
                const xsrf = op.session.state && op.session.state.secret;
                return this.renderLogout(ctx, xsrf);
            });
        };
        this.renderLogoutEnd = async (ctx) => {
            return ctx.op.render("logout.end");
        };
        // ref: https://github.com/panva/node-oidc-provider/blob/e5ecd85c346761f1ac7a89b8bf174b873be09239/lib/actions/end_session.js#L272
        this.postLogoutSuccessSourceProxy = async (ctx) => {
            return this.wrapContext(ctx, async () => {
                const op = ctx.op;
                op.clientMetadata = await op.getPublicClientProps(ctx.oidc.client);
                return this.renderLogoutEnd(ctx);
            });
        };
        this.renderDeviceFlow = async (ctx, userCode, xsrf) => {
            return ctx.op.render("device_flow", undefined, {
                "device_flow.submit": {
                    url: ctx.op.getNamedURL("code_verification"),
                    method: "POST",
                    payload: {
                        xsrf,
                        user_code: userCode,
                    },
                },
            });
        };
        // ref: https://github.com/panva/node-oidc-provider/blob/74b434c627248c82ca9db5aed3a03f0acd0d7214/lib/actions/code_verification.js#L38
        this.deviceFlowUserCodeInputSourceProxy = (ctx, formHTML, out, error) => {
            return this.wrapContext(ctx, () => {
                const op = ctx.op;
                ctx.assert(op.user && op.client);
                if (error || out) {
                    this.logger.error("internal device code flow error", error || out);
                    throw out || error;
                }
                const xsrf = op.session.state && op.session.state.secret;
                return this.renderDeviceFlow(ctx, ctx.oidc.params.user_code || "", xsrf);
            });
        };
        this.renderDeviceFlowConfirm = async (ctx, userCode, xsrf, device) => {
            return ctx.op.render("device_flow.confirm", undefined, {
                "device_flow.verify": {
                    url: ctx.op.getNamedURL("code_verification"),
                    method: "POST",
                    payload: {
                        xsrf,
                        user_code: userCode,
                        confirm: "true",
                    },
                },
                "device_flow.abort": {
                    url: ctx.op.getNamedURL("code_verification"),
                    method: "POST",
                    payload: {
                        xsrf,
                        user_code: userCode,
                        abort: "true",
                    },
                },
            });
        };
        // ref: https://github.com/panva/node-oidc-provider/blob/74b434c627248c82ca9db5aed3a03f0acd0d7214/lib/actions/code_verification.js#L54
        this.deviceFlowUserCodeConfirmSourceProxy = (ctx, formHTML, client, device, userCode) => {
            return this.wrapContext(ctx, () => {
                const op = ctx.op;
                ctx.assert(op.user && op.client);
                op.device = device;
                const xsrf = op.session.state && op.session.state.secret;
                return this.renderDeviceFlowConfirm(ctx, userCode, xsrf, device);
            });
        };
        this.renderDeviceFlowEnd = async (ctx) => {
            return ctx.op.render("device_flow.end");
        };
        // ref: https://github.com/panva/node-oidc-provider/blob/ae8a4589c582b96f4e9ca0432307da15792ac29d/lib/actions/authorization/device_user_flow_response.js#L42
        this.deviceFlowSuccessSourceProxy = (ctx) => {
            return this.wrapContext(ctx, () => {
                return this.renderDeviceFlowEnd(ctx);
            });
        };
        this._config = {
            url: (ctx, interaction) => {
                return `${this.prefix}/${interaction.prompt.name}`;
            },
            policy: [],
        };
        this.logger = builder.logger;
        // create router
        this.router = new koa_router_1.default({
            prefix: this.prefix,
            sensitive: true,
            strict: false,
        })
            .use(this.routerMiddleware);
        this.router._setPrefix = this.router.prefix.bind(this.router);
        this.router.prefix = () => {
            this.logger.warn("rather call builder.setPrefix, it will not affect");
            return this.router;
        };
        // create federation builder
        this.federation = new federation_1.IdentityFederationBuilder(this.builder);
    }
    get prefix() {
        return this._prefix;
    }
    _dangerouslySetPrefix(prefix) {
        this.builder.assertBuilding();
        this._prefix = prefix;
        this.router._setPrefix(prefix)
            .use(this.routerMiddleware); // re-apply middleware
        this.logger.info(`OIDC application route path configured:`, `${prefix}/:path`);
    }
    get idp() {
        return this.builder.idp;
    }
    get op() {
        return this.builder._dagerouslyGetProvider();
    }
    translateError(ctx, error) {
        const opts = {
            ns: "error",
            lng: ctx.locale.language,
        };
        error.error_description = i18n_1.I18N.translate(`${error.error}.description`, error.error_description, opts);
        error.error = i18n_1.I18N.translate(`${error.error}.name`, error.error, opts);
        // translate validation error data
        if (error.error === idp_1.IAMErrors.ValidationError.name && error.data) {
            /* to translate validation error field labels, send request like..
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json;charset=UTF-8",
              "Payload-Labels": Buffer.from(JSON.stringify({
                "email": "이메일",
                "password": "패스워드",
                "nested.field": "...",
              }), "utf8").toString("base64"),
            },
            */
            let labels;
            try {
                const encodedLabels = ctx.request.get("Payload-Labels");
                if (encodedLabels) {
                    labels = JSON.parse(Buffer.from(encodedLabels, "base64").toString("utf8"));
                }
            }
            catch (err) {
                this.logger.error(err);
            }
            for (const entry of error.data) {
                const { actual, expected, type, field } = entry;
                entry.message = i18n_1.I18N.translate(`${error.error}.data.${type}`, entry.message, {
                    ...opts,
                    // @ts-ignore
                    actual,
                    expected: (expected && type === "equalField" && labels && labels[expected]) || expected,
                    field: (field && labels && labels[field]) || field,
                });
            }
        }
        return error;
    }
    // default render function
    setRendererFactory(factory, options) {
        this._appRenderer = factory({
            prefix: this.prefix,
            dev: this.builder.dev,
            logger: this.logger,
        }, options);
        return this;
    }
    get appRenderer() {
        if (!this._appRenderer) {
            this.setRendererFactory(renderer_1.dummyAppStateRendererFactory);
        }
        return this._appRenderer;
    }
    setRoutesFactory(factory) {
        this._routesFactory = factory;
        return this;
    }
    getRoutes(promptName) {
        if (!this._routesFactory) {
            this.logger.warn("routes factory not configured; which is to ensure available xhr/page request endpoints for each prompts");
            return {};
        }
        return this._routesFactory(promptName);
    }
    setPrompts(prompts) {
        this.builder.assertBuilding();
        this._config.policy.splice(0, this._config.policy.length, ...prompts);
        return this;
    }
    _dangerouslyGetDynamicConfiguration() {
        this.builder.assertBuilding();
        const { renderErrorProxy, logoutSourceProxy, postLogoutSuccessSourceProxy, deviceFlowUserCodeInputSourceProxy, deviceFlowUserCodeConfirmSourceProxy, deviceFlowSuccessSourceProxy, } = this;
        return {
            renderError: renderErrorProxy,
            logoutSource: logoutSourceProxy,
            interactions: this._config,
            postLogoutSuccessSource: postLogoutSuccessSourceProxy,
            features: {
                deviceFlow: {
                    userCodeInputSource: deviceFlowUserCodeInputSourceProxy,
                    userCodeConfirmSource: deviceFlowUserCodeConfirmSourceProxy,
                    successSource: deviceFlowSuccessSourceProxy,
                },
            },
        };
    }
    _dangerouslyBuild() {
        this.builder.assertBuilding();
        // normalize oidc-provider original error for xhr error response, ref: https://github.com/panva/node-oidc-provider/blob/master/lib/shared/error_handler.js#L49
        this.op.app.middleware.unshift(async (ctx, next) => {
            await next();
            if (ctx.body && typeof ctx.body.error === "string") {
                ctx.body.error = change_case_1.pascalCase(ctx.body.error);
                ctx.body = { error: this.translateError(ctx, ctx.body) };
            }
        });
        // mount app renderer and app
        this.op.app.use(koa_compose_1.default([
            // apply additional "app renderer" middleware (like serving static files), order matters for security's sake
            ...(this.appRenderer.routes ? this.appRenderer.routes() : []),
            // apply "app router" middleware
            // this.router.allowedMethods(), // support "OPTIONS" methods
            this.router.routes(),
        ]));
        // build federation configuration
        this.federation._dangerouslyBuild();
    }
}
exports.ProviderApplicationBuilder = ProviderApplicationBuilder;
//# sourceMappingURL=app.js.map