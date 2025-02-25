import _ from "lodash";
import { RecursivePartial } from "../interface";
import { Logger } from "../logger";
import { Branch, SchemaRegistry } from "../schema";
import {
  ServerApplication,
  ServerApplicationOptions,
  APIRequestContextFactoryConstructors,
  APIRequestContextFactoryConstructorOptions,
  defaultAPIRequestContextFactoryConstructorOptions,
  APIRequestContextFactory,
  Route,
  HTTPRoute,
} from "./application";
import { ServerMiddlewareConstructorOptions, defaultServerMiddlewareConstructorOptions, ServerMiddlewareConstructors } from "./middleware";
import { ServerProtocol, ServerProtocolConstructorOptions, defaultServerProtocolConstructorOptions, ServerProtocolConstructors } from "./protocol";

export type APIServerProps = {
  schema: SchemaRegistry;
  logger: Logger;
};

export type APIServerUpdateOptions = {
  debouncedSeconds: number;
  maxDebouncedSeconds: number;
};

export type APIServerOptions = {
  update: APIServerUpdateOptions;
  application: ServerApplicationOptions;
  middleware: ServerMiddlewareConstructorOptions;
  protocol: ServerProtocolConstructorOptions;
  context: APIRequestContextFactoryConstructorOptions;
};

export class APIServer {
  private readonly opts: APIServerOptions;
  private readonly app: ServerApplication;
  private readonly protocols: ServerProtocol[];

  constructor(
    private props: APIServerProps,
    opts?: RecursivePartial<APIServerOptions>,
  ) {
    // adjust options
    this.opts = _.defaultsDeep(opts || {}, {
      update: {
        debouncedSeconds: 2,
        maxDebouncedSeconds: 5,
      },
      application: {},
      context: defaultAPIRequestContextFactoryConstructorOptions,
      middleware: {},
      protocol: defaultServerProtocolConstructorOptions,
    });
    this.opts.update.debouncedSeconds = isNaN(this.opts.update.debouncedSeconds) ? 2 : Math.max(this.opts.update.debouncedSeconds, 0);
    this.opts.update.maxDebouncedSeconds = isNaN(this.opts.update.maxDebouncedSeconds) ? 5 : Math.max(this.opts.update.maxDebouncedSeconds, this.opts.update.debouncedSeconds, 1);

    // create context factory
    const contextFactories = Object.entries(this.opts.context).reduce((factories, [k, options]) => {
      const key = k as keyof APIRequestContextFactoryConstructorOptions;
      if (options !== false) {
        factories.push(
          new APIRequestContextFactoryConstructors[key](
            {
              logger: this.props.logger.getChild(`context/${key}`),
            },
            options,
          ),
        );
      }
      return factories;
    }, [] as APIRequestContextFactory<any>[]);
    this.props.logger.info(`gateway context factories have been applied ${contextFactories.join(", ")}`);

    // create application
    this.app = new ServerApplication(
      {
        logger: this.props.logger.getChild(`application`),
        contextFactories,
      },
      this.opts.application,
    );

    // override middleware options
    const middlewareKeyAndOptions: [keyof ServerMiddlewareConstructorOptions, any][] = [];
    for (const [k, defaultOptions] of Object.entries(defaultServerMiddlewareConstructorOptions)) {
      const key = k as keyof ServerMiddlewareConstructorOptions;
      const overriding = this.opts.middleware[key];
      if (typeof overriding !== "undefined") {
        middlewareKeyAndOptions.push([key, overriding ? _.defaultsDeep(overriding, defaultOptions) : overriding]);
      } else {
        middlewareKeyAndOptions.push([key, defaultOptions]);
      }
    }

    // create middleware
    const middleware = middlewareKeyAndOptions
      .filter(([key, options]) => options !== false)
      .map(([key, options]) => {
        return new ServerMiddlewareConstructors[key](
          {
            logger: this.props.logger.getChild(`middleware/${key}`),
          },
          options,
        );
      });

    // apply application middleware
    for (const middle of middleware) {
      middle.apply(this.app.componentModules);
    }
    this.props.logger.info(`gateway server middleware have been applied: ${middleware.join(", ")}`);

    // create protocol
    this.protocols = Object.entries(this.opts.protocol).reduce((protocols, [k, options]) => {
      const key = k as keyof ServerProtocolConstructorOptions;
      if (options !== false) {
        protocols.push(
          new ServerProtocolConstructors[key](
            {
              logger: this.props.logger.getChild(`protocol/${key}`),
            },
            options,
          ),
        );
      }
      return protocols;
    }, [] as ServerProtocol[]);
  }

  /* lifecycle */
  public async start() {
    // start application
    await this.app.start();

    // make server protocol listen
    const listeningURIs: string[] = [];
    for (const protocol of this.protocols) {
      listeningURIs.push(...(await protocol.start(this.app.componentModules)));
    }
    this.props.logger.info(`gateway server protocol has been started: ${this.protocols.join(", ")}`);

    if (listeningURIs.length > 0) {
      this.props.logger.info(`gateway server has been started and listening on: ${listeningURIs.join(", ")}`);
    } else {
      this.props.logger.error(`gateway server has been started but there are no bound network interfaces`);
    }

    // start schema registry and connect handler update methods
    const debouncedBranchUpdateHandlers = new Map<Branch, () => Promise<void>>();
    const debouncedBranchRemovedHandlers = new Map<Branch, () => Promise<void>>();
    await this.props.schema.start({
      // enhance 'updated', 'removed' handler to be debounced for each of branches
      updated: (branch) => {
        let handler = debouncedBranchUpdateHandlers.get(branch);
        if (!handler) {
          handler = _.debounce(
            () => {
              return this.app.mountBranchHandler(branch);
            },
            1000 * this.opts.update.debouncedSeconds,
            { maxWait: 1000 * this.opts.update.maxDebouncedSeconds },
          );
          debouncedBranchUpdateHandlers.set(branch, handler);
        }
        return handler();
      },
      removed: (branch) => {
        let handler = debouncedBranchRemovedHandlers.get(branch);
        if (!handler) {
          handler = _.debounce(
            () => {
              return this.app.unmountBranchHandler(branch).finally(() => {
                debouncedBranchUpdateHandlers.delete(branch);
                debouncedBranchRemovedHandlers.delete(branch);
              });
            },
            1000 * this.opts.update.debouncedSeconds,
            { maxWait: 1000 * this.opts.update.maxDebouncedSeconds },
          );
          debouncedBranchRemovedHandlers.set(branch, handler);
        }
        return handler();
      },
    });

    // add information route for debugging
    // this.app.addStaticRoute(
    //   new HTTPRoute({
    //     path: "/~",
    //     method: "GET",
    //     description: "",
    //     handler: (ctx, req, res) => {
    //       res.json(this.props.schema.information);
    //     },
    //   }),
    // );
  }

  public async stop() {
    // stop application
    await this.app.stop();

    for (const protocol of this.protocols) {
      await protocol.stop();
      this.props.logger.info(`gateway server protocol has been stopped: ${protocol}`);
    }
    this.props.logger.info(`gateway server has been stopped`);

    // stop schema registry
    await this.props.schema.stop();
  }
}
