/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/* eslint-disable no-prototype-builtins */
import qs from "qs";
import * as url from "url";
import { APIRequestContextFactory, APIRequestContextProps, APIRequestContextSource } from "./index";

export type APIRequestContextConstructor = (source: APIRequestContextSource) => Promise<APIRequestContext>;

export interface APIRequestContext extends APIRequestContextProps {}

type APIRequestContextStore = Map<symbol, APIRequestContextStoreItemClearer>;
type APIRequestContextStoreItemClearer = [any, (value: any) => void];

export class APIRequestContext {
  protected constructor(props: APIRequestContextProps) {
    Object.assign(this, props);
    Object.defineProperty(this, APIRequestContext.StoreSymbol, { value: new Map(), enumerable: true, configurable: false, writable: false }); // should be enumerable, ... for plugins which adjust given context
  }

  private static SourceContextIsCreatingSymbol = Symbol("APIRequestContextIsCreating");
  private static SourceContextSymbol = Symbol("APIRequestContext");
  private static StoreSymbol = Symbol("APIRequestContextStore");

  public static createConstructor(
    factories: ReadonlyArray<APIRequestContextFactory<any>>,
    hooks?: {
      before?: (source: APIRequestContextSource) => void;
      after?: (source: APIRequestContextSource, context: APIRequestContext) => void;
    },
  ): APIRequestContextConstructor {
    return async (source) => {
      if (source.hasOwnProperty(APIRequestContext.SourceContextIsCreatingSymbol)) {
        throw new Error("request already handled"); // TODO: normalize error
      }

      // update headers for websocket headers (blabla?headers=JSON.stringify({ ... }))
      if (source.headers.connection === "upgrade") {
        try {
          const { query } = url.parse(source.url!);
          if (query) {
            const headersJSON = qs.parse(query, { allowPrototypes: true }).headers;
            if (headersJSON && typeof headersJSON === "string") {
              const headers = JSON.parse(headersJSON);
              for (const [k, v] of Object.entries(headers)) {
                if (typeof v === "string") {
                  source.headers[k.toLowerCase()] = v;
                }
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      // add reference to source which denote parsing context currently
      Object.defineProperty(source, APIRequestContext.SourceContextIsCreatingSymbol, { value: true });

      if (hooks && hooks.before) {
        hooks.before(source);
      }

      // create props
      const props: APIRequestContextProps = {};
      const propEntries = await Promise.all(factories.map(async (factory) => [factory.key, await factory.create(source)] as [string, any]));
      for (const [k, v] of propEntries) {
        props[k as keyof APIRequestContextProps] = v;
      }

      // create context
      const context = new APIRequestContext(props);

      // add reference to source
      Object.defineProperty(source, APIRequestContext.SourceContextSymbol, { value: context });

      if (hooks && hooks.after) {
        hooks.after(source, context);
      }

      return context;
    };
  }

  public static find(source: APIRequestContextSource): APIRequestContext | null {
    if (source.hasOwnProperty(APIRequestContext.SourceContextSymbol)) {
      return (source as any)[APIRequestContext.SourceContextSymbol];
    }
    return null;
  }

  public static findProps(source: APIRequestContextSource): APIRequestContextProps | null {
    if (source.hasOwnProperty(APIRequestContext.SourceContextSymbol)) {
      return (source as any)[APIRequestContext.SourceContextSymbol];
    }
    return null;
  }

  public static isCreating(source: APIRequestContextSource): boolean {
    return source.hasOwnProperty(APIRequestContext.SourceContextIsCreatingSymbol);
  }

  /* internal store for broker delegator and plugins */
  public set<T>(symbol: symbol, value: T, clear: (value: T) => void): void {
    const store: APIRequestContextStore = (this as any)[APIRequestContext.StoreSymbol];
    store.set(symbol, [value, clear]);
  }

  public get(symbol: symbol): any {
    const store: APIRequestContextStore = (this as any)[APIRequestContext.StoreSymbol];
    const item = store.get(symbol);
    return item ? item[0] : undefined;
  }

  public clear() {
    const store: APIRequestContextStore = (this as any)[APIRequestContext.StoreSymbol];
    for (const [value, clear] of store.values()) {
      clear(value);
    }
    store.clear();
  }
}
