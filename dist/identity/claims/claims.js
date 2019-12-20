"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const vm = tslib_1.__importStar(require("vm"));
const object_hash_1 = tslib_1.__importDefault(require("object-hash"));
const validator_1 = require("../../validator");
const error_1 = require("../error");
const types_1 = require("./types");
const options_1 = require("./options");
class IdentityClaimsManager {
    constructor(props, opts) {
        this.props = props;
        this.logger = props.logger || console;
        // compile payload validation functions
        this.validatePayload = validator_1.validator.compile(types_1.IdentityClaimsSchemaPayloadValidationSchema);
        // prepare base claims
        this.options = _.defaultsDeep(opts || {}, options_1.defaultIdentityClaimsManagerOptions);
    }
    /* lifecycle */
    start() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            // define mandatory claims and base claims
            const payloads = [
                {
                    scope: "openid",
                    key: "sub",
                    description: "account id",
                    validation: "string",
                },
                ...this.options.baseClaims,
            ];
            yield Promise.all(payloads.map(payload => this.defineClaimsSchema(payload)));
            this.logger.info("identity claims manager has been started");
        });
    }
    stop() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.logger.info("identity claims manager has been stopped");
        });
    }
    /* to update claims schema */
    hashClaimsSchemaPayload(payload) {
        return object_hash_1.default(payload, {
            algorithm: "md5",
            unorderedArrays: true,
            unorderedObjects: true,
            unorderedSets: true,
        });
    }
    createClaimsSchema(payload) {
        const result = this.validatePayload(payload);
        if (result !== true) {
            throw new error_1.Errors.ValidationError(result, {
                payload,
            });
        }
        const schema = Object.assign(Object.assign({}, payload), { version: this.hashClaimsSchemaPayload(payload), active: true });
        return schema;
    }
    compileClaimsValidator(schema) {
        const validate = validator_1.validator.compile({
            [schema.key]: schema.validation,
            $$strict: true,
        });
        return (claims) => {
            const result = validate({ [schema.key]: claims });
            if (result !== true) {
                throw new error_1.Errors.ValidationError(result, {
                    [schema.key]: claims,
                });
            }
        };
    }
    compileClaimsMigrationStrategy(schema) {
        // compile function
        try {
            const script = new vm.Script(`(${schema.migration})(oldClaim, seedClaim, claims)`, {
                displayErrors: true,
                timeout: 100,
            });
            return (oldClaim, seedClaim, claims) => {
                return script.runInNewContext({ oldClaim, seedClaim: _.cloneDeep(seedClaim), claims });
            };
        }
        catch (error) {
            throw new error_1.Errors.ValidationError([], { migration: schema.migration, error });
        }
    }
    get mandatoryScopes() {
        return [...new Set(this.options.mandatoryScopes.concat(["openid"]))];
    }
    getActiveClaimsSchemata() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.props.adapter.getClaimsSchemata({ scope: [], active: true });
        });
    }
    forceReloadClaims(where) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.logger.info(`force reload identity claims: onClaimsUpdated()`, where);
            let transaction;
            try {
                transaction = yield this.props.adapter.transaction();
                yield this.props.adapter.onClaimsSchemaUpdated();
                // migrate in batches
                const limit = 100;
                let offset = 0;
                while (true) {
                    const identities = yield this.props.adapter.get({ where, offset, limit });
                    if (identities.length === 0)
                        break;
                    yield Promise.all(identities.map((identity) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        try {
                            yield this.props.adapter.onClaimsUpdated(identity);
                        }
                        catch (error) {
                            this.logger.error("failed to reload user claims", error);
                            throw error;
                        }
                    })));
                    offset += limit;
                }
                yield transaction.commit();
            }
            catch (error) {
                this.logger.error(`force reload identity claims failed`, error);
                if (transaction) {
                    yield transaction.rollback();
                }
                throw error;
            }
        });
    }
    forceReleaseMigrationLock(key) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.logger.info(`force release migration lock:`, key);
            yield this.props.adapter.releaseMigrationLock(key);
        });
    }
    forceDeleteClaimsSchemata(...keys) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const key of keys) {
                yield this.props.adapter.acquireMigrationLock(key);
                let transaction;
                try {
                    transaction = yield this.props.adapter.transaction();
                    this.logger.info("force delete claims schema:", key);
                    yield this.props.adapter.forceDeleteClaimsSchema(key);
                    yield this.props.adapter.onClaimsSchemaUpdated();
                    yield transaction.commit();
                }
                catch (error) {
                    if (transaction) {
                        yield transaction.rollback();
                    }
                    this.logger.error("failed to force delete claims schema:", key);
                    throw error;
                }
                finally {
                    yield this.props.adapter.releaseMigrationLock(key);
                }
            }
        });
    }
    defineClaimsSchema(payload) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.props.adapter.acquireMigrationLock(payload.key);
            try {
                // validate payload and create schema
                const schema = this.createClaimsSchema(payload);
                // compile claims schema and validate it with default value
                const validateClaims = this.compileClaimsValidator(schema);
                // compile migration function
                const migrateClaims = this.compileClaimsMigrationStrategy(schema);
                // restore inactive schema version if does
                const inactiveSchema = yield this.props.adapter.getClaimsSchema({ key: schema.key, version: schema.version, active: false });
                if (inactiveSchema) {
                    this.logger.info(`activate identity claims schema for ${schema.key}:${schema.version.substr(0, 8)}`);
                    // tslint:disable-next-line:no-shadowed-variable
                    let transaction;
                    try {
                        transaction = yield this.props.adapter.transaction();
                        // activate
                        yield this.props.adapter.setActiveClaimsSchema({ key: schema.key, version: schema.version });
                        yield this.props.adapter.onClaimsSchemaUpdated();
                        // migrate in batches
                        const limit = 100;
                        let offset = 0;
                        while (true) {
                            const identities = yield this.props.adapter.get({ offset, limit });
                            if (identities.length === 0)
                                break;
                            yield Promise.all(identities.map((identity) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                try {
                                    yield this.props.adapter.onClaimsUpdated(identity);
                                }
                                catch (error) {
                                    this.logger.error("failed to update user claims", error);
                                    throw error;
                                }
                            })));
                            offset += limit;
                        }
                        yield transaction.commit();
                        return schema;
                    }
                    catch (error) {
                        this.logger.error(`identity claims migration failed`, error);
                        if (transaction) {
                            yield transaction.rollback();
                        }
                        throw error;
                    }
                }
                // get current active schema
                const activeSchema = yield this.props.adapter.getClaimsSchema({ key: schema.key, active: true });
                // if has exactly same schema
                if (activeSchema && activeSchema.version === schema.version) {
                    this.logger.info(`skip identity claims schema migration for ${activeSchema.key}:${activeSchema.version.substr(0, 8)}`);
                    yield this.props.adapter.onClaimsSchemaUpdated(); // for the case of distributed system
                    return activeSchema;
                }
                // get target schema
                let parentSchema;
                if (schema.parentVersion) { // from specific version
                    parentSchema = yield this.props.adapter.getClaimsSchema({ key: schema.key, version: schema.parentVersion });
                    if (!parentSchema) {
                        throw new error_1.Errors.ValidationError([], { parentVersion: schema.parentVersion });
                    }
                }
                else {
                    parentSchema = activeSchema;
                    schema.parentVersion = parentSchema ? parentSchema.version : undefined;
                }
                // update user client claims
                this.logger.info(`start identity claims migration: ${schema.key}:${schema.parentVersion ? schema.parentVersion.substr(0, 8) + " -> " : ""}${schema.version.substr(0, 8)}`);
                let transaction;
                try {
                    // begin transaction
                    transaction = yield this.props.adapter.transaction();
                    // create new claims schema
                    yield this.props.adapter.createClaimsSchema(schema);
                    yield this.props.adapter.setActiveClaimsSchema({ key: schema.key, version: schema.version });
                    yield this.props.adapter.onClaimsSchemaUpdated();
                    // migrate in batches
                    const limit = 100;
                    let offset = 0;
                    while (true) {
                        const identities = yield this.props.adapter.get({ offset, limit });
                        if (identities.length === 0)
                            break;
                        yield Promise.all(identities.map((identity, index) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            // validate new claims and save
                            let oldClaim;
                            let newClaim;
                            let claims;
                            try {
                                // create new value
                                claims = yield identity.claims();
                                oldClaim = parentSchema
                                    ? yield this.props.adapter.getVersionedClaims(identity, [{
                                            key: schema.key,
                                            schemaVersion: schema.parentVersion,
                                        }])
                                        .then(result => result[schema.key])
                                    : undefined;
                                oldClaim = typeof oldClaim === "undefined" ? null : oldClaim;
                                newClaim = migrateClaims(oldClaim, schema.seed, claims);
                                newClaim = typeof newClaim === "undefined" ? null : newClaim;
                                this.logger.info(`migrate user claims ${identity.id}:${schema.key}:${schema.version.substr(0, 8)}`, oldClaim, "->", newClaim);
                                // validate and store it
                                validateClaims(newClaim);
                                yield this.props.adapter.createOrUpdateVersionedClaims(identity, [{
                                        key: schema.key,
                                        value: newClaim,
                                        schemaVersion: schema.version,
                                    }]);
                                if (JSON.stringify(oldClaim) !== JSON.stringify(newClaim)) {
                                    yield this.props.adapter.onClaimsUpdated(identity);
                                }
                            }
                            catch (error) {
                                const detail = { id: identity.id, oldClaim, newClaim, error, index: index + offset };
                                this.logger.error("failed to update user claims", detail);
                                throw new error_1.Errors.ValidationError([], detail);
                            }
                        })));
                        offset += limit;
                    }
                    // commit transaction
                    yield transaction.commit();
                    this.logger.info(`identity claims migration finished: ${schema.key}:${schema.parentVersion ? schema.parentVersion.substr(0, 8) + " -> " : ""}${schema.version.substr(0, 8)}`);
                    return schema;
                }
                catch (error) { // failed to migrate, revoke migration
                    this.logger.error(`identity claims migration failed`, error);
                    // rollback transaction
                    if (transaction) {
                        yield transaction.rollback();
                    }
                    throw error;
                }
            }
            finally {
                yield this.props.adapter.releaseMigrationLock(payload.key);
            }
        });
    }
}
exports.IdentityClaimsManager = IdentityClaimsManager;
//# sourceMappingURL=claims.js.map