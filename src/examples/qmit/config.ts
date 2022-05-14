import { context, vault } from "qmit-sdk";
import 'dotenv/config';
// create global configuration
// can fetch vault secrets in local/kubernetes environment

/* istanbul ignore next */
export const config =  {
  env: process.env.QMIT_APP_ENV,
  isDev: process.env.QMIT_APP_ENV === "dev",
  isDebug: !!process.env.APP_DEBUG,
  oidc: {
    issuer: process.env.issuer as string,
    client_id: process.env.client_id as string,
    client_secret: process.env.client_secret as string,
  },
  // sentry: ((await get(`${appEnv}/data/sentry`)).data as {
  //   dsn: string;
  // }),
  // example: (await get("common/data/test")).data,
  sandbox: {
    appEnv: process.env.QMIT_APP_ENV,
    abc: 1234,
  },
};
