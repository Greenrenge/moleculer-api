import { IPolicyPluginCatalog, IPolicyPluginSchema } from "../plugin";

export type ProtectPolicyPluginSchema = IPolicyPluginSchema & boolean;

export type ProtectPolicyPluginCatalog = IPolicyPluginCatalog & {
  type: string;
  description: string | null;
  protected: ProtectPolicyPluginSchema;
};
