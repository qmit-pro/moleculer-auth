"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function buildConsentRoutes(builder, opts) {
    builder.app.router
        .get("/consent", async (ctx) => {
        const { client, interaction } = ctx.op;
        ctx.op.assertPrompt(["consent"]);
        // skip consent if client has skip_consent property
        if (client && client.skip_consent) {
            return ctx.op.redirectWithUpdate({
                consent: {
                    rejectedScopes: [],
                    rejectedClaims: [],
                    replace: true,
                },
            });
        }
        // or render consent form
        return ctx.op.render("consent");
    })
        // handle consent
        .post("/consent/accept", async (ctx) => {
        ctx.op.assertPrompt(["consent"]);
        const { rejected_scopes = [], rejected_claims = [] } = ctx.request.body;
        // finish consent app and give redirection uri
        return ctx.op.redirectWithUpdate({
            consent: {
                rejectedScopes: rejected_scopes,
                rejectedClaims: rejected_claims,
                replace: true,
            },
        });
    });
}
exports.buildConsentRoutes = buildConsentRoutes;
//# sourceMappingURL=consent.js.map