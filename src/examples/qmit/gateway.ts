import url from "url";
import { moleculer } from "../../moleculer-utils/moleculer";
import { config } from "./config";
import { APIGateway, Logger } from "../../";
import { ApolloError } from "apollo-server-core";
import { APIRequestContextSource, AuthContext, createAuthContextOIDCParser } from "../../server";
import { ApolloServerPlugin } from "apollo-server-plugin-base";
// import * as Sentry from '@sentry/node';
// const Tracing = require("@sentry/tracing");
// import { RewriteFrames  } from "@sentry/integrations";

const { oidc, isDebug, isDev, env } = config;

// Sentry.init({
//   environment: env === "dev" ? "stage" : "production",
//   // see why we use APP_NAME here: https://github.com/getsentry/sentry-cli/issues/482
//   release: `PLCO_API_GATEWAY`,
//   dsn: sentry.dsn,
//   integrations: [
//     // used for rewriting SourceMaps from js to ts
//     // check that sourcemaps are enabled in tsconfig.js
//     // read the docs https://docs.sentry.io/platforms/node/typescript/
//     // new RewriteFrames({
//     //   root: process.cwd(),
//     // }) as any,
//     // Output sended data by Sentry to console.log()
//     // new Debug({ stringify: true }),
//   ],
// });

export const gateway = new APIGateway({
  brokers: [
    {
      moleculer: moleculer.createServiceBrokerOptions({
        tracing: {
          // TODO: dig into what causes GC crash for stopping broker when tracing enabled...
          enabled: false,
        },
        requestTimeout: 7 * 1000, // in milliseconds,
        retryPolicy: {
          enabled: true,
          retries: 7,
          delay: 200,
          maxDelay: 3000,
          factor: 2,
          check: (err) => {
            return err && !!(err as any).retryable;
          },
        },
        circuitBreaker: {
          enabled: true,
          threshold: 0.5,
          windowTime: 60,
          minRequestCount: 20,
          halfOpenTime: 10 * 1000,
          check: (err) => {
            return err && (err as any).code && (err as any).code >= 500;
          },
        },
      }) as any,
    },
  ],
  schema: {
    branch: {
      maxVersions: 10,
      maxUnusedSeconds: 60 * 10,
    },
    protocol: {
      GraphQL: {
        playground: isDev,
        introspection: true,
        debug: isDebug,
        plugins: [
          {
            requestDidStart(_) {
              return {
                didEncounterErrors(ctx) {
                  if (!ctx.operation) {
                    return;
                  }

                  if (ctx.context.auth) {
                    // Sentry.setUser({
                    //   id: ctx.context.auth.identity.sub,
                    //   email: ctx.context.auth.identity.email,
                    // });
                  }
                  for (const err of ctx.errors) {
                    // Only report internal server errors,
                    // all errors extending ApolloError should be user-facing
                    if (err instanceof ApolloError) {
                      continue;
                    } else {
                      // Sentry.captureException(err);
                    }

                    // Sentry.withScope(scope => {
                    //   scope.setTag("kind", ctx.operation?.operation);
                    //   scope.setExtra("operationName", ctx.operationName);
                    //   scope.setExtra("query", ctx.request.query);
                    //   scope.setExtra("variables", ctx.request.variables);
                    //   if (err.path) {
                    //     scope.addBreadcrumb({
                    //       category: "query-path",
                    //       message: err.path.join(" > "),
                    //       level: Sentry.Severity.Debug
                    //     });
                    //   }
                    //   const transactionId = ctx.request.http?.headers.get(
                    //     "X-Transaction-ID"
                    //   );
                    //   if (transactionId) {
                    //     scope.setTransactionName(transactionId);
                    //   }
                    //   Sentry.captureException(err);
                    // });
                  }
                },
              };
            },
          },
        ],
      },
    },
  },
  logger: {
    winston: {
      level: isDebug ? "debug" : "info",
    },
  },
  server: {
    application: {
      http: {
        trustProxy: true,
      },
      ws: {
        pingPongCheckInterval: 5000,
      },
    },
    context: {
      auth: {
        parser: createAuthContextOIDCParser(oidc),
        impersonator: async (source: APIRequestContextSource, auth: AuthContext, logger: Logger) => {
          if (auth.identity && auth.identity.impersonator === true && source.url) {
            const parsedURL = url.parse(source.url, true);
            if (parsedURL.query.impersonation) {
              auth.identity._impersonator_sub = auth.identity.sub;
              auth.identity.sub = parsedURL.query.impersonation;
              logger.warn(`${auth.identity._impersonator_sub}:${auth.identity.email} has impersonated as ${auth.identity.sub}`);
            }
          }
        },
      },
    },
    protocol: {
      http: {
        port: 8080,
        hostname: "0.0.0.0",
      },
    },
    middleware: {
      cors: {
        origin: true,
        disableForWebSocket: false,
      },
      error: {
        displayErrorStack: isDev,
      },
    },
  },
});
