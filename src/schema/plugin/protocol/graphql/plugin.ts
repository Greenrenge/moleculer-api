import * as _ from "lodash";
import { RecursivePartial, ValidationError, validateObject, validateValue, ValidationRule, hashObject } from "../../../../interface";
import { Branch } from "../../../branch";
import { ServiceAPIIntegration } from "../../../integration";
import { Route, HTTPRoute, WebSocketRoute } from "../../../../server";
import { ConnectorCompiler, ConnectorValidator } from "../../connector";
import { ProtocolPlugin, ProtocolPluginProps } from "../plugin";

import { DocumentNode, GraphQLIsTypeOfFn, GraphQLFormattedError } from "graphql";
import { TypeDefinitionNode, TypeExtensionNode, ScalarTypeDefinitionNode, ScalarTypeExtensionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, parse as parseGraphQLSchema, print as printGraphQLSchema } from "graphql/language";
import { IResolvers, IResolverObject, IFieldResolver, IResolverOptions } from "graphql-tools";
import { GraphQLHandlers, GraphQLHandlersOptions, defaultGraphQLHandlersOptions } from "./handler";
import {
  GraphQLCallableFieldResolverSchema,
  GraphQLIsTypeOfFieldResolverSchema,
  GraphQLMappableFieldResolverSchema,
  GraphQLProtocolPluginCatalog,
  GraphQLProtocolPluginSchema,
  GraphQLProtocolResolversSchema,
  GraphQLPublishableFieldResolverSchema,
  GraphQLSubscribableFieldResolverSchema,
} from "./schema";

export type GraphQLProtocolPluginOptions = GraphQLHandlersOptions;

export class GraphQLProtocolPlugin extends ProtocolPlugin<GraphQLProtocolPluginSchema, GraphQLProtocolPluginCatalog> {
  public static readonly key = "GraphQL";
  public static readonly autoLoadOptions: GraphQLProtocolPluginOptions = defaultGraphQLHandlersOptions;
  private readonly opts: GraphQLProtocolPluginOptions;

  private static allowedDefKinds = [
    "ObjectTypeDefinition",
    "ObjectTypeExtension",
    "InterfaceTypeDefinition",
    "InterfaceTypeExtension",
    "UnionTypeDefinition",
    "UnionTypeExtension",
    "EnumTypeDefinition",
    "EnumTypeExtension",
    "InputObjectTypeDefinition",
  ];
  private static readonly resolverAllowedDefKinds = ["ObjectTypeDefinition", "ObjectTypeExtension"];
  private static readonly resolverRequiredTypeNames = ["Query", "Mutation", "Subscription"];
  private static readonly isTypeOfFieldName = "__isTypeOf";
  private static readonly forbiddenFieldNames = ["__isTypeOf", "__resolveType", "isTypeOf", "resolveType"];

  constructor(
    protected readonly props: ProtocolPluginProps,
    opts?: RecursivePartial<GraphQLProtocolPluginOptions>,
  ) {
    super(props);
    this.opts = _.defaultsDeep(opts || {}, GraphQLProtocolPlugin.autoLoadOptions);
  }

  public async start(): Promise<void> {}

  public async stop(): Promise<void> {}

  public validateSchema(schema: GraphQLProtocolPluginSchema): ValidationError[] {
    const typeDefs: Exclude<TypeDefinitionNode | TypeExtensionNode, ScalarTypeDefinitionNode | ScalarTypeExtensionNode>[] = [];
    let typeDefsString: string = "";
    const result = validateObject(
      schema,
      {
        description: {
          type: "string",
          optional: true,
        },
        typeDefs: {
          type: "custom",
          check(value: any) {
            // parse graphql.documentNode which might have been generated with gql` ... `
            if (typeof value === "object" && value !== null) {
              try {
                typeDefsString = value = printGraphQLSchema(value);
              } catch (error: any) {
                return [
                  {
                    field: `typeDefs`,
                    type: "typeDefsSyntax",
                    message: error?.message,
                    actual: value,
                  },
                ];
              }
            }

            // parse string
            if (typeof value !== "string") {
              return [
                {
                  field: `typeDefs`,
                  type: "typeDefsSyntax",
                  message: "type definitions must be string or valid graphql.DocumentNode",
                  actual: value,
                },
              ];
            }

            const errors: ValidationError[] = [];
            try {
              // parse GraphQL Schema
              const doc = parseGraphQLSchema(value, { noLocation: false });
              for (const def of doc.definitions) {
                if (!GraphQLProtocolPlugin.allowedDefKinds.includes(def.kind)) {
                  errors.push({
                    field: `typeDefs`,
                    type: "typeDefsForbidden",
                    // @ts-ignore
                    message: `${def.name ? `${def.name.value} (${def.kind})` : def.kind} is not allowed`,
                    actual: printGraphQLSchema(def),
                  });
                } else {
                  typeDefs.push(def as any);
                }
              }
            } catch (error: any) {
              // parsing error
              const location = (error.locations && error.locations[0]) || null;
              errors.push({
                field: `typeDefs`,
                type: "typeDefsSyntax",
                message: error.message.replace("Syntax Error: ", ""),
                actual: value,
                location,
              });
            }
            return errors.length === 0 ? true : errors;
          },
        },
        resolvers: {
          type: "custom",
          check(value: any) {
            if (typeof value !== "object" || value === null) {
              return [
                {
                  field: `resolvers`,
                  type: "resolversInvalid",
                  message: "type resolvers should be an object",
                  actual: value,
                },
              ];
            }

            const errors: ValidationError[] = [];
            const typeDefsByName = typeDefs.reduce(
              (obj, typeDef) => {
                const typeName = typeDef.name.value;
                if (!obj[typeName]) {
                  obj[typeName] = [];
                }
                obj[typeName].push(typeDef as any);
                return obj;
              },
              {} as { [name: string]: (ObjectTypeDefinitionNode | ObjectTypeExtensionNode)[] },
            );

            for (const [typeName, partialTypeDefs] of Object.entries(typeDefsByName)) {
              const typeResolver = value[typeName];

              // not a type which can have resolver
              if (!partialTypeDefs.every((def) => GraphQLProtocolPlugin.resolverAllowedDefKinds.includes(def.kind))) {
                // this type should not have resolver
                if (typeof typeResolver !== "undefined") {
                  errors.push({
                    field: `resolvers.${typeName}`,
                    type: "typeResolverInvalid",
                    message: `${typeName} cannot have a type resolver`,
                    actual: typeResolver,
                    expected: undefined,
                  });
                }
                continue;
              }

              const typeFieldNames = partialTypeDefs.reduce((fieldNames, typeDef) => {
                if (typeDef.fields) {
                  fieldNames.push(...typeDef.fields.map((f) => f.name.value));
                }
                return fieldNames;
              }, [] as string[]);
              const typeForbiddenFieldNames = typeFieldNames.filter((f) => GraphQLProtocolPlugin.forbiddenFieldNames.includes(f));

              // type has forbidden fields
              if (typeForbiddenFieldNames.length > 0) {
                errors.push({
                  field: `typeDefs`,
                  type: "typeDefsForbidden",
                  message: `${typeName} cannot define preserved fields`,
                  actual: typeForbiddenFieldNames,
                  expected: undefined,
                });
                continue;
              }

              // __isTypeOf field resolver is required for interface implementation
              const interfaceNames = partialTypeDefs.reduce((names, typeDef) => {
                if (typeDef.interfaces) {
                  names.push(...typeDef.interfaces.map((i) => i.name.value));
                }
                return names;
              }, [] as string[]);
              const isTypeOfFieldResolverRequired = interfaceNames.length > 0;
              if (isTypeOfFieldResolverRequired) {
                typeFieldNames.push(GraphQLProtocolPlugin.isTypeOfFieldName);
              }

              // type has no resolver
              if (typeof typeResolver !== "object" || typeResolver === null) {
                // this type should have resolver
                if (GraphQLProtocolPlugin.resolverRequiredTypeNames.includes(typeName) || isTypeOfFieldResolverRequired) {
                  errors.push({
                    field: `resolvers.${typeName}`,
                    type: "typeResolverRequired",
                    message: `${typeName} should have a type resolver`,
                    actual: typeResolver,
                    expected: `${typeFieldNames.length > 0 ? `{ [fieldName in "${typeFieldNames.join(`" | "`)}"]: GraphQLFieldResolverSchema }` : "{}"} }`,
                  });
                }
                continue;
              }

              // all fields of resolvers should have been defined on typeDef
              const typeResolverKeys = Object.keys(typeResolver);
              for (const resolverFieldName of typeResolverKeys) {
                if (!typeFieldNames.includes(resolverFieldName)) {
                  errors.push({
                    field: `resolvers.${typeName}.${resolverFieldName}`,
                    type: "fieldResolverUnnecessary",
                    message: `${typeName} have an unnecessary field resolver for ${resolverFieldName}`,
                    actual: typeResolver[resolverFieldName],
                    expected: undefined,
                  });
                }
              }

              // check field resolvers
              for (const fieldName of typeFieldNames) {
                const fieldResolver = typeResolver[fieldName];

                // check __isTypeOf field resolver
                if (fieldName === GraphQLProtocolPlugin.isTypeOfFieldName) {
                  if (typeof fieldResolver !== "string") {
                    errors.push({
                      field: `resolvers.${typeName}.${fieldName}`,
                      type: typeof fieldResolver === "undefined" ? "fieldResolverRequired" : "fieldResolverInvalid",
                      message: `${typeName} should have an ${fieldName} field resolver which is a string denotes a JavaScript function to distinguish the type among types which implement interfaces: ${interfaceNames.join(", ")}`,
                      actual: fieldResolver,
                      expected: `GraphQLIsTypeOfFieldResolverSchema`,
                    });
                  }
                  continue;
                }

                // check regular field resolver
                let rule: ValidationRule[] | ValidationRule;
                switch (typeName) {
                  case "Mutation":
                    if (typeof fieldResolver === "object" && fieldResolver !== null && typeof fieldResolver.call !== "undefined") {
                      rule = {
                        type: "object",
                        strict: true,
                        props: {
                          call: ConnectorValidator.call,
                        },
                        messages: {
                          objectStrict: "GraphQLCallableFieldResolverSchema cannot be with other connectors",
                        },
                      };
                    } else if (typeof fieldResolver === "object" && fieldResolver !== null && typeof fieldResolver.publish !== "undefined") {
                      rule = {
                        type: "object",
                        strict: true,
                        props: {
                          publish: ConnectorValidator.publish,
                        },
                        messages: {
                          objectStrict: "GraphQLPublishableFieldResolverSchema cannot be with other connectors",
                        },
                      };
                    } else if (typeof fieldResolver === "string") {
                      rule = ConnectorValidator.map;
                    } else {
                      errors.push({
                        field: `resolvers.${typeName}.${fieldName}`,
                        type: typeof fieldResolver === "undefined" ? "fieldResolverRequired" : "fieldResolverInvalid",
                        message: `${typeName} should have an ${fieldName} field resolver which is an object having either call, publish property or a string which denotes a JavaScript function`,
                        expected: `Omit<GraphQLCallableFieldResolverSchema, "ignoreError"> | GraphQLPublishableFieldResolverSchema | GraphQLMappableFieldResolverSchema`,
                      });
                    }
                    break;

                  case "Subscription":
                    if (typeof fieldResolver === "object" && fieldResolver !== null && typeof fieldResolver.subscribe !== "undefined") {
                      rule = {
                        type: "object",
                        strict: true,
                        props: {
                          subscribe: ConnectorValidator.subscribe,
                        },
                        messages: {
                          objectStrict: "GraphQLCallableFieldResolverSchema cannot be with other connectors",
                        },
                      };
                    } else {
                      errors.push({
                        field: `resolvers.${typeName}.${fieldName}`,
                        type: typeof fieldResolver === "undefined" ? "fieldResolverRequired" : "fieldResolverInvalid",
                        message: `${typeName} should have an ${fieldName} field resolver which is an object having subscribe property`,
                        expected: `GraphQLSubscribableFieldResolverSchema`,
                      });
                    }
                    break;

                  case "Query":
                  default:
                    if (typeof fieldResolver === "object" && fieldResolver !== null && typeof fieldResolver.call !== "undefined") {
                      rule = {
                        type: "object",
                        strict: true,
                        props: {
                          call: ConnectorValidator.call,
                          ignoreError: {
                            type: "boolean",
                            optional: true,
                          },
                        },
                        messages: {
                          objectStrict: "GraphQLCallableFieldResolverSchema cannot be with other connectors",
                        },
                      };
                    } else if (typeof fieldResolver === "string") {
                      rule = ConnectorValidator.map;
                    } else {
                      // regular types can omit field resolvers (use default field resolver)
                      if (typeof fieldResolver === "undefined" && typeName !== "Query") {
                        break;
                      }

                      errors.push({
                        field: `resolvers.${typeName}.${fieldName}`,
                        type: typeof fieldResolver === "undefined" ? "fieldResolverRequired" : "fieldResolverInvalid",
                        message: `${typeName} should have an ${fieldName} field resolver which is either an object having call property or a string which denotes a JavaScript function`,
                        expected: `GraphQLCallableFieldResolverSchema | GraphQLMappableFieldResolverSchema`,
                      });
                    }
                    break;
                }

                // @ts-ignore
                if (rule) {
                  errors.push(
                    ...validateValue(
                      fieldResolver,
                      // @ts-ignore
                      rule,
                      {
                        strict: true,
                        field: `resolvers.${typeName}.${fieldName}`,
                      },
                    ),
                  );
                }
              } // end-of: typeFieldNames for-loop
            } // end-of: typeDefs for-loop

            return errors.length === 0 ? true : errors;
          },
        },
      },
      {
        strict: true,
      },
    );

    // convert original typeDefs as string too for human-readable information
    if (typeDefsString) {
      schema.typeDefs = typeDefsString;
    }
    return result;
  }

  public compileSchemata(routeHashMapCache: Readonly<Map<string, Readonly<Route>>>, integrations: Readonly<ServiceAPIIntegration>[], branch: Branch): { hash: string; route: Readonly<Route> }[] {
    const items = new Array<{ hash: string; route: Readonly<Route> }>();

    /* calculate integrated hash to fetch cached handlers */
    const hashes: string[] = [];
    for (const integration of integrations) {
      const schema: GraphQLProtocolPluginSchema = (integration.schema.protocol as any)[this.key];

      // the source object below hash contains properties which can make this route unique
      hashes.push(hashObject([schema.typeDefs, schema.resolvers, integration.service.hash], true));
    }

    const routeHash = hashObject(hashes, false);
    const subscriptionRouteHash = `${routeHash}@subscription`;
    const playgroundRouteHash = `static@graphql-playground`;

    // cache hit
    const cachedRoute = routeHashMapCache.get(routeHash);
    const cachedSubscriptionRoute = routeHashMapCache.get(subscriptionRouteHash);
    const cachedPlaygroundRoute = routeHashMapCache.get(playgroundRouteHash);
    if (cachedRoute) {
      items.push({ hash: routeHash, route: cachedRoute });

      // both playground and subscription handlers are optional
      if (cachedSubscriptionRoute) {
        items.push({ hash: subscriptionRouteHash, route: cachedSubscriptionRoute });
      }
      if (cachedPlaygroundRoute) {
        items.push({ hash: playgroundRouteHash, route: cachedPlaygroundRoute });
      }

      return items;
    }

    // create new GraphQL routes
    const { route, subscriptionRoute, playgroundRoute } = this.createGraphQLHandlers(integrations);
    items.push({ hash: routeHash, route });

    // both playground and subscription handlers are optional
    if (subscriptionRoute) {
      items.push({ hash: subscriptionRouteHash, route: subscriptionRoute });
    }
    if (playgroundRoute) {
      items.push({ hash: playgroundRouteHash, route: playgroundRoute });
    }

    return items;
  }

  // TODO: GraphQL Plugin catalog
  public describeSchema(schema: Readonly<GraphQLProtocolPluginSchema>): GraphQLProtocolPluginCatalog {
    return {} as GraphQLProtocolPluginCatalog;
  }

  // @throwable
  private createGraphQLHandlers(integrations: Readonly<ServiceAPIIntegration>[]): { route: Readonly<HTTPRoute>; subscriptionRoute?: Readonly<WebSocketRoute>; playgroundRoute?: Readonly<HTTPRoute> } {
    const typeDefs: string[] = [];
    let resolvers: IResolvers = {};
    for (const integration of integrations) {
      const schema: GraphQLProtocolPluginSchema = (integration.schema.protocol as any)[this.key];
      typeDefs.push(typeof schema.typeDefs === "string" ? schema.typeDefs : printGraphQLSchema(schema.typeDefs));
      resolvers = _.merge<IResolvers, IResolvers>(resolvers, this.createGraphQLResolvers(schema.resolvers, integration));
    }

    // merge base typeDefs
    if (this.opts.typeDefs) {
      typeDefs.push(...(Array.isArray(this.opts.typeDefs) ? this.opts.typeDefs : [this.opts.typeDefs]).map((defs) => (typeof defs === "string" ? defs : printGraphQLSchema(defs))));
    }

    const resolversList = [resolvers];
    if (this.opts.resolvers) {
      resolversList.push(...(Array.isArray(this.opts.resolvers) ? this.opts.resolvers : [this.opts.resolvers]));
    }

    const { handler, subscriptionHandler, playgroundHandler } = new GraphQLHandlers(
      (message) => {
        this.props.logger.error(message);
      },
      {
        ...this.opts,
        typeDefs,
        resolvers: resolversList,
      },
    );

    return {
      route: new HTTPRoute({
        method: "POST",
        path: "/graphql",
        description: "GraphQL HTTP operation endpoint",
        handler,
      }),
      subscriptionRoute: subscriptionHandler
        ? new WebSocketRoute({
            path: "/graphql",
            description: "GraphQL WebSocket operation endpoint",
            handler: subscriptionHandler,
          })
        : undefined,
      playgroundRoute: playgroundHandler
        ? new HTTPRoute({
            method: "GET",
            path: "/graphql",
            description: "GraphQL Playground endpoint",
            handler: playgroundHandler,
          })
        : undefined,
    };
  }

  private createGraphQLResolvers(resolversSchema: Readonly<GraphQLProtocolResolversSchema>, integration: Readonly<ServiceAPIIntegration>): IResolvers {
    const resolvers: IResolvers = {};
    const { Query, Mutation, Subscription, ...ObjectTypes } = resolversSchema;

    // create query resolver
    if (Query) {
      const typeResolver = (resolvers.Query = {} as IResolverObject);
      for (const [fieldName, fieldSchema] of Object.entries(Query)) {
        if (typeof fieldSchema === "string") {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromMapConnectorSchema(fieldSchema, integration);
        } else if (fieldSchema && fieldSchema.call) {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromCallConnectorSchema(fieldSchema, integration);
        }
      }
    }

    // create mutation resolver
    if (Mutation) {
      const typeResolver = (resolvers.Mutation = {} as IResolverObject);
      for (const [fieldName, fieldSchema] of Object.entries(Mutation)) {
        if (typeof fieldSchema === "string") {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromMapConnectorSchema(fieldSchema, integration);
        } else if (fieldSchema && (fieldSchema as GraphQLCallableFieldResolverSchema).call) {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromCallConnectorSchema(fieldSchema as GraphQLCallableFieldResolverSchema, integration);
        } else if (fieldSchema && (fieldSchema as GraphQLPublishableFieldResolverSchema).publish) {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromPublishConnectorSchema(fieldSchema as GraphQLPublishableFieldResolverSchema, integration);
        }
      }
    }

    // create subscription resolver
    if (Subscription) {
      const typeResolver = (resolvers.Subscription = {} as IResolverObject);
      for (const [fieldName, fieldSchema] of Object.entries(Subscription)) {
        if (fieldSchema && fieldSchema.subscribe) {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromSubscribeConnectorSchema(fieldSchema, integration);
        }
      }
    }

    // create other object resolvers
    for (const [typeName, ObjectType] of Object.entries(ObjectTypes)) {
      const typeResolver = (resolvers[typeName] = {} as IResolverObject);
      for (const [fieldName, fieldSchema] of Object.entries(ObjectType)) {
        if (typeof fieldSchema === "string") {
          if (fieldName === GraphQLProtocolPlugin.isTypeOfFieldName) {
            typeResolver[fieldName] = this.createGraphQLIsTypeOfFnFromMapConnectorSchema(fieldSchema, integration);
          } else {
            typeResolver[fieldName] = this.createGraphQLFieldResolverFromMapConnectorSchema(fieldSchema, integration);
          }
        } else if (fieldSchema && fieldSchema.call) {
          typeResolver[fieldName] = this.createGraphQLFieldResolverFromCallConnectorSchema(fieldSchema, integration);
        }
      }
    }

    return resolvers;
  }

  private createGraphQLFieldResolverFromMapConnectorSchema(schema: GraphQLMappableFieldResolverSchema, integration: Readonly<ServiceAPIIntegration>): IFieldResolver<any, any> {
    const mapConnector = ConnectorCompiler.map(schema, integration, {
      mappableKeys: ["context", "source", "args", "info"],
    });

    return (source, args, context, info) => mapConnector({ context, source, args, info });
  }

  private createGraphQLIsTypeOfFnFromMapConnectorSchema(schema: GraphQLIsTypeOfFieldResolverSchema, integration: Readonly<ServiceAPIIntegration>): GraphQLIsTypeOfFn<any, any> {
    const mapConnector = ConnectorCompiler.map(schema, integration, {
      mappableKeys: ["context", "source", "info"],
    });

    return (source, context, info) => mapConnector({ context, source, info });
  }

  private createGraphQLFieldResolverFromCallConnectorSchema(schema: GraphQLCallableFieldResolverSchema, integration: Readonly<ServiceAPIIntegration>): IFieldResolver<any, any> {
    const callConnector = ConnectorCompiler.call(schema.call, integration, this.props.policyPlugins, {
      explicitMappableKeys: ["context", "source", "args", "info"],
      implicitMappableKeys: ["source", "args"],
      batchingEnabled: true,
      disableCache: false,
    });

    const { ignoreError } = schema;

    return (source, args, context, info) => {
      const mappableArgs = { source, args, context, info };
      return callConnector(context, mappableArgs).catch((error) => {
        if (ignoreError) {
          return null;
        } else {
          throw error;
        }
      });
    };
  }

  private createGraphQLFieldResolverFromPublishConnectorSchema(schema: GraphQLPublishableFieldResolverSchema, integration: Readonly<ServiceAPIIntegration>): IFieldResolver<any, any> {
    const publishConnector = ConnectorCompiler.publish(schema.publish, integration, this.props.policyPlugins, {
      mappableKeys: ["context", "source", "args", "info"],
    });

    return (source, args, context, info) => publishConnector(context, { context, source, args, info });
  }

  private createGraphQLFieldResolverFromSubscribeConnectorSchema(schema: GraphQLSubscribableFieldResolverSchema, integration: Readonly<ServiceAPIIntegration>): IResolverOptions<any, any> {
    const subscribeConnector = ConnectorCompiler.subscribe(schema.subscribe, integration, this.props.policyPlugins, {
      mappableKeys: ["context", "source", "args", "info"],
      getAsyncIterator: true,
    });

    return {
      subscribe: (source, args, context, info) => subscribeConnector(context, { context, source, args, info }, null),
    };
  }
}
