"use strict";
/*
 * moleculer-iam
 * Copyright (c) 2019 QMIT Inc. (https://github.com/qmit-pro/moleculer-iam)
 * MIT Licensed
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const moleculer_1 = require("moleculer");
const identity_1 = require("../identity");
const oidc_1 = require("../oidc");
const server_1 = require("../server");
const params_1 = require("./params");
function IAMServiceSchema(opts) {
    let idp;
    let oidc;
    let server;
    return {
        created() {
            // create identity provider
            idp = this.idp = new identity_1.IdentityProvider({
                logger: this.broker.getLogger("idp"),
            }, opts.idp);
            // create oidc provider
            oidc = this.oidc = new oidc_1.OIDCProvider({
                idp,
                logger: this.broker.getLogger("oidc"),
            }, opts.oidc);
            // create server
            server = this.server = new server_1.IAMServer({
                oidc,
                logger: this.broker.getLogger("server"),
            }, opts.server);
        },
        started() {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield server.start();
            });
        },
        stopped() {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield server.stop();
            });
        },
        name: "iam",
        settings: {},
        hooks: {
            // transform OIDC provider error
            error: {
                "*"(ctx, err) {
                    if (err.status === 422) {
                        throw new moleculer_1.Errors.ValidationError(err.error_description, null, err.fields);
                    }
                    else if (err.status <= 400 && err.status < 500) {
                        throw new moleculer_1.Errors.MoleculerClientError(err.error_description, err.statusCode, err.error);
                    }
                    else if (err.status >= 500) {
                        throw new moleculer_1.Errors.MoleculerServerError(err.error_description, err.statusCode, err.error);
                    }
                    throw err;
                },
            },
        },
        actions: {
            /* Client Management */
            "client.create": {
                description: `
          Create OIDC Client. All params from below reference will be accepted.
          ref: https://openid.net/specs/openid-connect-registration-1_0.html#ClientMetadata
        `,
                params: params_1.IAMServiceActionParams["client.create"],
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const client = yield oidc.createClient(ctx.params);
                        this.broker.broadcast("iam.client.updated");
                        return client;
                    });
                },
            },
            "client.update": {
                params: params_1.IAMServiceActionParams["client.update"],
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const client = yield oidc.updateClient(ctx.params);
                        this.broker.broadcast("iam.client.updated");
                        return client;
                    });
                },
            },
            "client.delete": {
                params: {
                    id: "string",
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield oidc.deleteClient(ctx.params.id);
                        this.broker.broadcast("iam.client.deleted", ctx.params); // 'oidc-provider' has a hard coded LRU cache internally... using pub/sub to clear distributed nodes' cache
                        return true;
                    });
                },
            },
            "client.find": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    id: "string",
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        return oidc.findClient(ctx.params.id);
                    });
                },
            },
            "client.get": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    where: {
                        type: "any",
                        optional: true,
                    },
                    offset: {
                        type: "number",
                        positive: true,
                        default: 0,
                    },
                    limit: {
                        type: "number",
                        positive: true,
                        default: 10,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { offset, limit, where } = ctx.params;
                        const [total, entries] = yield Promise.all([
                            oidc.countClients(where),
                            oidc.getClients(ctx.params),
                        ]);
                        return { offset, limit, total, entries };
                    });
                },
            },
            "client.count": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    where: {
                        type: "any",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        return oidc.countClients(ctx.params && ctx.params.where);
                    });
                },
            },
            /* "Session", "AccessToken", "AuthorizationCode", "RefreshToken", "DeviceCode", "InitialAccessToken", "RegistrationAccessToken", "Interaction", "ReplayDetection", "PushedAuthorizationRequest" Management */
            "model.get": {
                cache: {
                    ttl: 30,
                },
                params: {
                    kind: {
                        type: "enum",
                        values: oidc_1.OIDCProvider.volatileModelNames,
                    },
                    where: {
                        type: "any",
                        optional: true,
                    },
                    offset: {
                        type: "number",
                        positive: true,
                        default: 0,
                    },
                    limit: {
                        type: "number",
                        positive: true,
                        default: 10,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const _a = ctx.params, { offset, limit, kind, where } = _a, args = tslib_1.__rest(_a, ["offset", "limit", "kind", "where"]);
                        const [total, entries] = yield Promise.all([
                            oidc.countModels(kind, where),
                            oidc.getModels(kind, Object.assign({ offset, limit, where }, args)),
                        ]);
                        return { offset, limit, total, entries };
                    });
                },
            },
            "model.count": {
                cache: {
                    ttl: 30,
                },
                params: {
                    kind: {
                        type: "enum",
                        values: oidc_1.OIDCProvider.volatileModelNames,
                    },
                    where: {
                        type: "any",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { kind, where } = ctx.params;
                        return oidc.countModels(kind, where);
                    });
                },
            },
            "model.delete": {
                params: {
                    kind: {
                        type: "enum",
                        values: oidc_1.OIDCProvider.volatileModelNames,
                    },
                    where: {
                        type: "any",
                        optional: false,
                    },
                    offset: {
                        type: "number",
                        positive: true,
                        default: 0,
                    },
                    limit: {
                        type: "number",
                        positive: true,
                        default: 10,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const _a = ctx.params, { kind } = _a, args = tslib_1.__rest(_a, ["kind"]);
                        return oidc.deleteModels(kind, args);
                    });
                },
            },
            /* Identity Claims Schema Management */
            "schema.get": {
                params: {
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                    key: {
                        type: "string",
                        empty: false,
                        trim: true,
                        optional: true,
                    },
                    version: {
                        type: "string",
                        empty: false,
                        trim: true,
                        optional: true,
                    },
                    active: {
                        type: "boolean",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        return idp.claims.getClaimsSchemata(ctx.params);
                    });
                },
            },
            "schema.find": {
                params: {
                    key: {
                        type: "string",
                        empty: false,
                        trim: true,
                    },
                    version: {
                        type: "string",
                        empty: false,
                        trim: true,
                        optional: true,
                    },
                    active: {
                        type: "boolean",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        return idp.claims.getClaimsSchema(ctx.params);
                    });
                },
            },
            "schema.define": {
                params: params_1.IAMServiceActionParams["schema.define"],
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const payload = ctx.params;
                        const oldSchema = yield idp.claims.getClaimsSchema({ key: payload.key, active: true });
                        const schema = yield idp.claims.defineClaimsSchema(payload);
                        if (!oldSchema || oldSchema.version !== schema.version) {
                            this.broker.broadcast("iam.schema.updated");
                        }
                        return schema;
                    });
                },
            },
            /* Identity Management */
            "id.validate": {
                params: {
                    id: {
                        type: "string",
                        optional: true,
                    },
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                    claims: {
                        type: "object",
                        default: {},
                    },
                    credentials: {
                        type: "object",
                        default: {},
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield idp.validate(ctx.params);
                        return ctx.params;
                    });
                },
            },
            "id.validateCredentials": {
                params: {
                    password: {
                        type: "string",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield idp.validateCredentials(ctx.params);
                        return ctx.params;
                    });
                },
            },
            "id.create": {
                params: {
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                    metadata: {
                        type: "object",
                        default: {},
                    },
                    claims: {
                        type: "object",
                        default: {},
                    },
                    credentials: {
                        type: "object",
                        default: {},
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const id = yield idp.create(ctx.params)
                            .then(i => i.json());
                        this.broker.broadcast("iam.id.updated");
                        return id;
                    });
                },
            },
            "id.update": {
                params: {
                    id: [
                        // support batching
                        {
                            type: "string",
                            optional: true,
                        },
                        {
                            type: "array",
                            items: "string",
                            optional: true,
                        },
                    ],
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                    claims: {
                        type: "object",
                        default: {},
                    },
                    metadata: {
                        type: "object",
                        default: {},
                    },
                    credentials: {
                        type: "object",
                        default: {},
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { id, claims, metadata, credentials, scope } = (ctx.params || {});
                        let result;
                        // batching
                        if (Array.isArray(id)) {
                            result = yield idp.get({ where: { id }, limit: id.length })
                                .then(ids => Promise.all(ids.map(i => i.update(scope, claims, metadata, credentials)
                                .then(() => i.json(scope), (err) => {
                                err.batchingError = true;
                                return err;
                            }))));
                        }
                        else {
                            result = yield idp.findOrFail({ id })
                                .then(i => i.update(scope, claims, metadata, credentials).then(() => i.json(scope)));
                        }
                        this.broker.broadcast("iam.id.updated");
                        return result;
                    });
                },
            },
            "id.delete": {
                params: {
                    id: [
                        // support batching
                        {
                            type: "string",
                            optional: true,
                        },
                        {
                            type: "array",
                            items: "string",
                            optional: true,
                        },
                    ],
                    permanently: {
                        type: "boolean",
                        default: false,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { id, permanently } = (ctx.params || {});
                        const where = { id, metadata: { softDeleted: permanently } };
                        // batching support
                        if (Array.isArray(id)) {
                            return idp.get({ where, limit: id.length })
                                .then(ids => Promise.all(ids.map(i => i.delete(permanently)
                                .then(() => i.id, (err) => {
                                err.batchingError = true;
                                return err;
                            }))));
                        }
                        return idp.findOrFail(where).then(i => i.delete(permanently)).then(() => id);
                    });
                },
            },
            "id.restore": {
                params: {
                    id: [
                        // support batching
                        {
                            type: "string",
                            optional: true,
                        },
                        {
                            type: "array",
                            items: "string",
                            optional: true,
                        },
                    ],
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { id } = (ctx.params || {});
                        const where = { id, metadata: { softDeleted: true } };
                        // batching support
                        if (Array.isArray(id)) {
                            return idp.get({ where, limit: id.length })
                                .then(ids => Promise.all(ids.map(i => i.restoreSoftDeleted()
                                .then(() => i.id, (err) => {
                                err.batchingError = true;
                                return err;
                            }))));
                        }
                        return idp.findOrFail(where).then(i => i.restoreSoftDeleted()).then(() => id);
                    });
                },
            },
            "id.find": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    id: [
                        // support batching
                        {
                            type: "string",
                            optional: true,
                        },
                        {
                            type: "array",
                            items: "string",
                            optional: true,
                        },
                    ],
                    email: {
                        type: "string",
                        optional: true,
                    },
                    phone_number: {
                        type: "string",
                        optional: true,
                    },
                    where: {
                        type: "any",
                        optional: true,
                    },
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // tslint:disable-next-line:prefer-const
                        let { id, email, phone_number, where, scope } = (ctx.params || {});
                        if (typeof where !== "object" || where === null)
                            where = {};
                        // batching support
                        if (Array.isArray(id)) {
                            return idp.get({ where: { id }, limit: id.length })
                                .then(ids => Promise.all(ids.map(i => i.json(scope)
                                .then(undefined, (err) => {
                                err.batchingError = true;
                                return err;
                            }))));
                        }
                        if (id)
                            where.id = id;
                        if (email) {
                            if (!where.claims)
                                where.claims = {};
                            where.claims.email = email;
                        }
                        if (phone_number) {
                            if (!where.claims)
                                where.claims = {};
                            where.claims.phone_number = phone_number;
                        }
                        if (Object.keys(where).length === 0)
                            where.id = null;
                        return idp.find(where).then(i => i ? i.json(scope) : null);
                    });
                },
            },
            "id.get": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    where: {
                        type: "any",
                        optional: true,
                    },
                    offset: {
                        type: "number",
                        positive: true,
                        default: 0,
                    },
                    limit: {
                        type: "number",
                        positive: true,
                        default: 10,
                    },
                    scope: [
                        {
                            type: "array",
                            items: {
                                type: "string",
                                trim: true,
                                empty: false,
                            },
                            default: [],
                            optional: true,
                        },
                        {
                            type: "string",
                            default: "",
                            optional: true,
                        },
                    ],
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const _a = (ctx.params || {}), { offset, limit, kind, where, scope } = _a, args = tslib_1.__rest(_a, ["offset", "limit", "kind", "where", "scope"]);
                        const [total, entries] = yield Promise.all([
                            idp.count(where),
                            idp.get(Object.assign({ offset, limit, where }, args)).then(ids => Promise.all(ids.map(i => i.json(scope)))),
                        ]);
                        return { offset, limit, total, entries };
                    });
                },
            },
            "id.count": {
                cache: {
                    ttl: 3600,
                },
                params: {
                    where: {
                        type: "any",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        return idp.count(ctx.params && ctx.params.where);
                    });
                },
            },
            "id.refresh": {
                cache: {
                    ttl: 5,
                },
                params: {
                    id: [
                        {
                            type: "string",
                            optional: true,
                        },
                        {
                            type: "array",
                            items: "string",
                            optional: true,
                        },
                    ],
                    where: {
                        type: "any",
                        optional: true,
                    },
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const { where, id } = ctx.params;
                        let ids;
                        if (typeof id === "string")
                            ids = [id];
                        else if (Array.isArray(id))
                            ids = id;
                        yield idp.claims.forceReloadClaims({ where, ids });
                        this.broker.broadcast("iam.id.updated");
                    });
                },
            },
        },
        events: {
            "iam.client.deleted": {
                // @ts-ignore
                params: {
                    id: "string",
                },
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        try {
                            // to clear internal memory cache
                            yield oidc.deleteClient(ctx.params.id);
                        }
                        catch (err) {
                            // ...NOTHING
                        }
                        finally {
                            yield this.clearCache("client.**");
                        }
                    });
                },
            },
            "iam.client.updated": {
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield this.clearCache("client.**");
                    });
                },
            },
            "iam.id.updated": {
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield this.clearCache("id.*");
                    });
                },
            },
            "iam.schema.updated": {
                handler(ctx) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield idp.claims.onClaimsSchemaUpdated();
                        yield this.clearCache("schema.*");
                        yield this.clearCache("id.*");
                    });
                },
            },
        },
        methods: {
            clearCache(...keys) {
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
                    if (this.broker.cacher) {
                        if (keys.length === 0) {
                            keys = ["**"];
                        }
                        const fullKeys = keys.map(key => `${this.fullName}.${key}`);
                        yield this.broker.cacher.clean(fullKeys);
                    }
                });
            },
        },
    };
}
exports.IAMServiceSchema = IAMServiceSchema;
//# sourceMappingURL=service.js.map