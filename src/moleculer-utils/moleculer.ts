import _ from "lodash";
import kleur from "kleur";
import os from "os";
import { ServiceBroker, BrokerOptions, Validator as MoleculerBaseValidator, Errors } from "moleculer";
import path from "path";
import fs from "fs";
import { ValidationErrorEntry, validator } from "./validator";

// for type hint
import Validator from "fastest-validator";
export { Validator };

// to serialize validator regexp pattern
if (typeof (RegExp.prototype as any).toJSON === "undefined") {
  Object.defineProperty(RegExp.prototype, "toJSON", {
    value() {
      return this.source.toString();
    },
  });
}

export class Moleculer {
  public readonly minInstalledVersion = "v0.7.1";
  public readonly installGuide = `- (optional) Install moleculer CLI by: "yarn global add moleculer-cli"
`;

  public createServiceBrokerOptions(override?: BrokerOptions, options: { quiet?: boolean } = {}): BrokerOptions {
    //     this.context.logger[options.quiet ? "debug" : "log"](`Creating moleculer service broker options with namespace=${kleur.blue(this.context.appEnv)} ${kleur.dim("(context.appEnv)")}\n`);

    /*
     * Default Moleculer Service Broker Configuration for QMIT Inc.
     */
    const defaults: BrokerOptions = {
      //       namespace: this.context.appEnv,
      // nodeID: undefined,
      //       replDelimiter: `${this.context.appEnv}:${this.context.clusterFullName}$`,

      logger: true,
      // logLevel: undefined,
      // logFormatter: "default",
      // logObjectPrinter: undefined,

      //       transporter: "redis://redis.internal.qmit.pro:6379",

      requestTimeout: 3 * 1000,
      retryPolicy: {
        enabled: true,
        retries: 3,
        delay: 100,
        maxDelay: 1000,
        factor: 2,
        check: (err) => {
          return err && !!(err as any).retryable;
        },
      },

      contextParamsCloning: false,
      maxCallLevel: 5,
      heartbeatInterval: 5,
      heartbeatTimeout: 15,

      tracking: {
        enabled: true,
        shutdownTimeout: 5000,
      },

      disableBalancer: false,

      registry: {
        strategy: "RoundRobin",
        preferLocal: true,
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

      bulkhead: {
        enabled: false,
        concurrency: 10,
        maxQueueSize: 100,
      },

      transit: {
        maxQueueSize: 50 * 1000, // 50k ~ 400MB,
        disableReconnect: false,
        disableVersionCheck: false,
      },

      // uidGenerator: undefined,

      // errorHandler: undefined,

      //       cacher: {
      //         type: "Redis",
      //         options: {
      //           ttl: 60,
      //           monitor: false,
      //           redis: {
      //             host: "redis.internal.qmit.pro",
      //             port: 6379,
      //             password: "",
      //             db: 0,
      //           },
      //         },
      //       },

      serializer: "JSON",

      // tslint:disable-next-line:new-parens max-classes-per-file
      validator: new (class CustomValidator extends MoleculerBaseValidator {
        private validator: any;
        constructor() {
          super();
          this.validator = validator;
        }
      })(),

      metrics: {
        enabled: true,
        reporter: [
          {
            type: "Event",
            options: {
              eventName: "$metrics.snapshot",
              broadcast: false,
              groups: null,
              onlyChanges: false,
              interval: 10 * 1000,
            },
          },
        ],
      },

      tracing: {
        enabled: true,
        events: true,
        stackTrace: true,
        exporter: [
          {
            type: "Event",
            options: {
              eventName: "$tracing.spans",
              sendStartSpan: false,
              sendFinishSpan: true,
              broadcast: false,
              groups: null,
              interval: 5,
              spanConverter: null,
              defaultTags: null,
            },
          },
        ],
      },

      internalServices: true,
      internalMiddlewares: true,

      hotReload: false,

      // middlewares: undefined,

      metadata: {},

      skipProcessEventRegistration: false,

      // ServiceFactory: null,
      // ContextFactory: null
      // Promise: null
    };

    return _.defaultsDeep(override || {}, defaults);
  }

  public createValidationError(errors: ValidationErrorEntry[]) {
    return new Errors.ValidationError("Parameters validation error!", null as any, errors);
  }

  public get validator() {
    return validator;
  }

  public runREPL() {
    const broker = new ServiceBroker(
      this.createServiceBrokerOptions({
        nodeID: `cli-${os.hostname().toLowerCase()}-${process.pid}`,
      }),
    );

    return broker.start().then(() => {
      broker.repl();
      return;
    });
  }

  public getCurrentContext(timeout = 2500) {
    const broker = new ServiceBroker(
      this.createServiceBrokerOptions(
        {
          nodeID: `cli-${os.hostname().toLowerCase()}-${process.pid}-tmp`,
          logger: false,
        },
        {
          quiet: true,
        },
      ),
    );

    const promise = broker.start().then(
      () => {
        const thisNode = broker.getLocalNodeInfo();
        return broker
          .call("$node.list", { onlyAvailable: true })
          .then((nodes: any) => {
            const localNodes = [];
            for (const node of nodes) {
              if (node.instanceID === thisNode.instanceID || node.id.endsWith("-tmp")) {
                continue;
              }
              if (node.ipList.every((ip: string) => thisNode.ipList.includes(ip))) {
                localNodes.push(node);
              }
            }
            return {
              namespace: nodes[0].metadata.namespace,
              nodes: localNodes,
            };
          })
          .catch(() => null);
      },
      () => null,
    );

    return Promise.race([
      new Promise((resolve) =>
        setTimeout(() => {
          console.log(kleur.dim(`Timeout for getting moleculer context in ${timeout}ms`));
          resolve(null);
        }, timeout),
      ),
      promise,
    ]).finally(() => broker.stop());
  }
}

const moleculer = new Moleculer();

export { moleculer };
