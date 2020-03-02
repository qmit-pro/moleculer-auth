"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
exports.defaultStaticConfig = {
    discovery: {
        claim_types_supported: [
            "normal",
        ],
        claims_locales_supported: ["en-US"],
        ui_locales_supported: ["en-US"],
        display_values_supported: ["page", "popup"],
        op_tos_uri: null,
        op_policy_uri: null,
        service_documentation: null,
    },
    // details
    cookies: {
        short: {
            path: "/",
            maxAge: 1000 * 60 * 60 * 24,
        },
        long: {
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 28,
        },
    },
    // ref: https://github.com/panva/node-oidc-provider/blob/master/docs/README.md
    features: {
        // token issue and management features
        userinfo: { enabled: true },
        introspection: { enabled: true },
        revocation: { enabled: true },
        backchannelLogout: { enabled: true },
        frontchannelLogout: { enabled: true },
        sessionManagement: { enabled: true },
        webMessageResponseMode: { enabled: true },
        deviceFlow: { enabled: true },
        // dynamic client registration
        registration: { enabled: true },
        registrationManagement: { enabled: true },
        // turn off development feature which composes dummy interactions
        devInteractions: { enabled: false },
    },
    responseTypes: [
        "code",
        "id_token", "id_token token",
        "code id_token", "code token", "code id_token token",
        "none",
    ],
    subjectTypes: [
        "public",
        "pairwise",
    ],
    pairwiseIdentifier(ctx, sub, client) {
        return crypto_1.default.createHash("sha256")
            .update(client.sectorIdentifier)
            .update(sub)
            .digest("hex");
    },
    pkceMethods: [
        "S256",
        "plain",
    ],
    clientDefaults: {
        grant_types: ["implicit", "authorization_code", "refresh_token"],
        response_types: ["code", "id_token", "id_token token", "code id_token", "code token", "code id_token token", "none"],
        token_endpoint_auth_method: "none",
    },
};
//# sourceMappingURL=config.default.js.map