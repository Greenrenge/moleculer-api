/* plugins */
import { RecursivePartial } from "../../../interface";
import { CallPolicySchema, PublishPolicySchema, SubscribePolicySchema } from "../connector";
import { FilterPolicyPlugin, FilterPolicyPluginOptions } from "./filter";
import { ScopePolicyPlugin, ScopePolicyPluginOptions } from "./scope";
import { ProtectPolicyPlugin, ProtectPolicyPluginOptions } from "./protect";
import { PolicyPlugin } from "./plugin";

export * from "./plugin";
export * from "./filter";
export * from "./scope";

export const PolicyPluginConstructors = {
  [FilterPolicyPlugin.key]: FilterPolicyPlugin,
  [ScopePolicyPlugin.key]: ScopePolicyPlugin,
  [ProtectPolicyPlugin.key]: ProtectPolicyPlugin,
};

export type PolicyPluginConstructorOptions = {
  [FilterPolicyPlugin.key]: RecursivePartial<FilterPolicyPluginOptions> | false;
  [ScopePolicyPlugin.key]: RecursivePartial<ScopePolicyPluginOptions> | false;
  [ProtectPolicyPlugin.key]: RecursivePartial<ProtectPolicyPluginOptions> | false;
};

export const defaultPolicyPluginConstructorOptions: PolicyPluginConstructorOptions = {
  [FilterPolicyPlugin.key]: FilterPolicyPlugin.autoLoadOptions,
  [ScopePolicyPlugin.key]: ScopePolicyPlugin.autoLoadOptions,
  [ProtectPolicyPlugin.key]: ProtectPolicyPlugin.autoLoadOptions,
};

export type PolicySchemaPluginProps = { [key in keyof typeof PolicyPluginConstructors]?: InstanceType<(typeof PolicyPluginConstructors)[key]> extends PolicyPlugin<infer Schema, any> ? Schema : never };

export type PolicySchema = {
  call?: (CallPolicySchema & PolicySchemaPluginProps)[];
  publish?: (PublishPolicySchema & PolicySchemaPluginProps)[];
  subscribe?: (SubscribePolicySchema & PolicySchemaPluginProps)[];
};

export type PolicyCatalog = { [key in keyof typeof PolicyPluginConstructors]?: InstanceType<(typeof PolicyPluginConstructors)[key]> extends PolicyPlugin<any, infer Catalog> ? Catalog : never };
