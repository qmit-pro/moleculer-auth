"use strict";

import { IAMServiceSchema } from "../../";
import { ServiceBroker } from "moleculer";
import { isDev } from "../qmit/iam";
import { app } from "./app";

// create moleculer service (optional)
const broker = new ServiceBroker({
  transporter: {
    type: "TCP",
    options: {
      udpPeriod: 1,
    },
  },
  cacher: "Memory",
});

const serviceSchema = IAMServiceSchema({
  idp: {
    adapter: {
      // type: "Memory",
      type: "RDBMS",
      options: {
        dialect: "mysql",
        host: "mysql-dev.internal.qmit.pro",
        database: "iam",
        username: "iam",
        password: "iam",
        sqlLogLevel: "debug",
      },
    },
  },
  oidc: {
    issuer: "http://localhost:9090",
    devMode: true,

    adapter: {
      // type: "Memory",
      type: "RDBMS",
      options: {
        dialect: "mysql",
        host: "mysql-dev.internal.qmit.pro",
        database: "iam",
        username: "iam",
        password: "iam",
        sqlLogLevel: "debug",
      },
    },

    // required and should be shared between processes in production
    cookies: {
      keys: ["blabla", "any secrets to encrypt", "cookies"],
    },

    // required and should be shared between processes in production
    jwks: require("./jwks.json"),

    interaction: {
      // federation
      federation: {
        /*
        kakao: {
          clientID: "XXX",
          clientSecret: "YYY",
        },
        google: {
          clientID: "XXX",
          clientSecret: "YYY",
        },
        facebook: {
          clientID: "XXX",
          clientSecret: "YYY",
        },
        */
      },
    },
    discovery: {
      ui_locales_supported: ["en-US", "ko-KR"],
      claims_locales_supported: ["en-US", "ko-KR"],
      // op_logo_uri: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
      op_tos_uri: "/help/tos",
      op_policy_uri: "/help/policy",
      service_documentation: "/help",
    },
  },
  server: {
    app,
    http: {
      hostname: "localhost",
      port: 9090,
    },
  },
});

broker.createService(serviceSchema);
broker.start();
