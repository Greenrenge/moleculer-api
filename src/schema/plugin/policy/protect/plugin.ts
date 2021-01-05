import * as _ from "lodash";
import { RecursivePartial, validateValue, ValidationError } from "../../../../interface";
import { ServiceAPIIntegration } from "../../../integration";
import { CallPolicyArgs, PublishPolicyArgs, SubscribePolicyArgs } from "../../connector";
import { CallPolicyTester, PolicyPlugin, PolicyPluginProps, PublishPolicyTester, SubscribePolicyTester } from "../plugin";
import { ProtectPolicyPluginCatalog, ProtectPolicyPluginSchema } from "./schema";

export type ProtectPolicyPluginOptions = {
  getScopesFromContext: (context: any) => string[];
};

export class ProtectPolicyPlugin extends PolicyPlugin<ProtectPolicyPluginSchema, ProtectPolicyPluginCatalog> {
  public static readonly key = "protected";
  public static readonly autoLoadOptions: ProtectPolicyPluginOptions = {
    getScopesFromContext: (ctx) => {
      return Array.isArray(ctx?.auth?.scope) ? ctx.auth.scope : [];
    },
  };
  private opts: ProtectPolicyPluginOptions;

  constructor(protected readonly props: PolicyPluginProps, opts?: RecursivePartial<ProtectPolicyPluginOptions>) {
    super(props);
    this.opts = _.defaultsDeep(opts || {}, ProtectPolicyPlugin.autoLoadOptions);
  }

  public validateSchema(schema: Readonly<ProtectPolicyPluginSchema>): ValidationError[] {
    return validateValue(schema, {
      type: 'boolean',
      default: false,
      optional: true,
    }, {
      field: "",
    });
  }

  public async start(): Promise<void> {
  }

  public async stop(): Promise<void> {
  }

  public describeSchema(schema: Readonly<ProtectPolicyPluginSchema>): ProtectPolicyPluginCatalog {
    return {} as ProtectPolicyPluginCatalog;
  }

  public compileCallPolicySchemata(schemata: Readonly<ProtectPolicyPluginSchema>, descriptions: ReadonlyArray<string|null>, integration: Readonly<ServiceAPIIntegration>): CallPolicyTester {
    return this.compilePolicySchemata(schemata, descriptions, integration) as CallPolicyTester;
  }

  public compilePublishPolicySchemata(schemata: Readonly<ProtectPolicyPluginSchema>, descriptions: ReadonlyArray<string|null>, integration: Readonly<ServiceAPIIntegration>): PublishPolicyTester {
    return this.compilePolicySchemata(schemata, descriptions, integration) as PublishPolicyTester;
  }

  public compileSubscribePolicySchemata(schemata: Readonly<ProtectPolicyPluginSchema>, descriptions: ReadonlyArray<string|null>, integration: Readonly<ServiceAPIIntegration>): SubscribePolicyTester {
    return this.compilePolicySchemata(schemata, descriptions, integration) as SubscribePolicyTester;
  }

  private compilePolicySchemata(
    schemata: Readonly<ProtectPolicyPluginSchema>, descriptions: ReadonlyArray<string|null>,
    integration: Readonly<ServiceAPIIntegration>
  ): CallPolicyTester | PublishPolicyTester | SubscribePolicyTester {
    const isProtected = schemata;

    return (args: Readonly<{ context: any; params: any; }>) => {
      const { context, params } = args;
      console.log('params:', params);
      console.log('args:', args);
      if(isProtected) {
        if(!(context.auth && context.auth.identity)) {
          const error: any = new Error("Unauthenticated");
          error.statusCode = 401;
          error.description = 'requires signin'
          throw error;
        }
      }
      return true;
    };
  }
}
