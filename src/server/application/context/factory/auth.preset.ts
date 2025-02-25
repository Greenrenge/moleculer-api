import { Issuer, Client } from "openid-client";
import { AuthContextParser } from "./auth";
// TODO: as composable presets

/* OIDC parser */
export type AuthContextOIDCParserOptions = {
  issuer: string;
  client_id: string;
  client_secret?: string;
};

export const createAuthContextOIDCParser = (opts: AuthContextOIDCParserOptions): AuthContextParser => {
  /* setup OIDC client and auth context parser */

  let oidcIssuer: Issuer<Client> | undefined;
  let oidcClient: Client | undefined;
  let discoverError: any | undefined;

  function discoverIssuer() {
    Issuer.discover(opts.issuer)
      .then((result) => {
        oidcIssuer = result;
        discoverError = undefined;
        oidcClient = new oidcIssuer.Client({ client_id: opts.client_id, client_secret: opts.client_secret });
      })
      .catch((err) => {
        discoverError = err;
      });

    // refresh issuer info for every 5min
    setTimeout(
      () => {
        discoverIssuer();
      },
      1000 * 60 * 5,
    );
  }

  discoverIssuer();

  return async (token, logger) => {
    if (!oidcClient) {
      logger.error(`failed to connect to OIDC provider: ${opts.issuer}`, discoverError);
      return;
    }
    let identity: any;
    let scope: any;
    let client: any;
    let maxAge: any;

    // get identity
    if (token && token.scheme === "Bearer" && typeof token.token === "string") {
      await oidcClient
        .userinfo(token.token)
        .then((res) => {
          if (res) {
            if (res.sub) {
              identity = res;
            } else {
              console.error(res, token);
              throw new Error("assertion: cannot be empty sub from IAM");
            }
          }
        })
        .catch((error) => {
          const err: any = new Error(error.message); // TODO: normalize error
          error.statusCode = 401;
          err.statusCode = 401;
          err.code = 401;
          throw err;
        });
    }

    // get client and scope
    if (token && token.scheme === "Bearer" && typeof token.token === "string") {
      await oidcClient
        .introspect(token.token)
        .then((res) => {
          // console.log(res);
          client = res.client_id;
          scope = res.scope.split(" ");
          maxAge = Math.floor(1577791463 * 1000 - new Date().getTime());
        })
        .catch((error) => {
          const err: any = new Error(error.message); // TODO: normalize error
          error.statusCode = 401;
          err.code = 401;
          throw err;
        });
    }

    return { identity, scope, client, maxAge };
  };
};
