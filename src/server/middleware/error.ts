import * as _ from "lodash";
import { RecursivePartial } from "../../interface";
import { HTTPRouteNextFn, HTTPRouteRequest, HTTPRouteResponse, ServerApplicationComponentModules, WebSocket, WebSocketHTTPRequest } from "../application/component";
import { ServerMiddleware, ServerMiddlewareProps } from "./middleware";

export type ErrorMiddlewareOptions = {
  displayErrorStack: boolean;
  responseFormat: (obj: any) => { status?: number; statusCode?: number; code?: number | string; [key: string]: any };
};

/*
  Uncaught Error handling middleware
*/

export class ErrorMiddleware extends ServerMiddleware {
  public static readonly key = "error";
  public static readonly autoLoadOptions = {
    displayErrorStack: true,
  };
  private readonly opts: ErrorMiddlewareOptions;

  constructor(
    protected readonly props: ServerMiddlewareProps,
    opts?: RecursivePartial<ErrorMiddlewareOptions>,
  ) {
    super(props);
    this.opts = _.defaultsDeep(opts || {}, ErrorMiddleware.autoLoadOptions);
  }

  public apply(modules: ServerApplicationComponentModules): void {
    /* HTTP Error & Not Found handling */
    const httpNotFoundHandler = this.handleHTTPNotFound.bind(this);
    const httpErrorHandler = this.handleHTTPError.bind(this);

    // arrange error handler to the last or stack on any sub app mounts
    // ref: http://expressjs.com/en/guide/error-handling.html
    const arrangeHTTPErrorHandlers = () => {
      const layers = modules.http._router.stack;

      // not found handler should be the last-1 layer
      const notFoundHandlerIndex = layers.findIndex((layer: any) => layer.handle === httpNotFoundHandler);
      console.assert(notFoundHandlerIndex !== -1, "where the http not found handler gone?");
      layers.push(...layers.splice(notFoundHandlerIndex, 1));

      // error handler should be the last layer
      const errorHandlerIndex = layers.findIndex((layer: any) => layer.handle === httpErrorHandler);
      console.assert(errorHandlerIndex !== -1, "where the http error handler gone?");
      layers.push(...layers.splice(errorHandlerIndex, 1));
    };

    // mount handlers
    modules.http.use(httpNotFoundHandler);
    modules.http.use(httpErrorHandler);
    arrangeHTTPErrorHandlers();
    modules.http.on("update", arrangeHTTPErrorHandlers);

    /* WebSocket Server Error handling */
    modules.ws.on("error", this.handleWebSocketError.bind(this));
  }

  private handleHTTPError(error: any, req: HTTPRouteRequest, res: HTTPRouteResponse, next: HTTPRouteNextFn): void {
    this.props.logger.error(error);

    if (res.headersSent) {
      return next(error);
    }

    const err = this.formatError(error);
    let status = (typeof err !== "string" && err.error && (err.error.status || err.error.statusCode || err.error.code)) || 500;
    if (isNaN(status)) status = 500;
    res.status(status).json(err); // TODO: normalize error
  }

  private handleHTTPNotFound(req: HTTPRouteRequest, res: HTTPRouteResponse, next: HTTPRouteNextFn): void {
    res.status(404).end();
  }

  private handleWebSocketError(error: any, socket?: WebSocket, req?: WebSocketHTTPRequest): void {
    if (socket) {
      socket.send(this.formatError(error, true)); // TODO: normalize error
    }
  }

  private formatError(error: any, stringify = false): { error: any } | string {
    const { responseFormat, displayErrorStack } = this.opts;
    let value: any = error;
    if (typeof error === "object" && error !== null) {
      const obj: any = {};
      for (const key of Object.getOwnPropertyNames(error)) {
        if (key !== "stack" || displayErrorStack) {
          obj[key] = error[key];
        }
      }
      value = obj;
    }

    if (responseFormat) {
      try {
        value = responseFormat(value);
      } catch (e) {
        this.props.logger.error("failed to format error", e);
      }
    }

    let result: any = { error: value };

    if (stringify) {
      try {
        result = JSON.stringify(result);
      } catch (e) {
        console.error("failed to stringify error", e);
        result = JSON.stringify({ error: error.toString(), truncated: true });
      }
    }

    return result;
  }
}
