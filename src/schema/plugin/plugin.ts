import { Pluggable, ValidationError } from "../../interface";
import { Logger } from "../../logger";

export type PluginProps = {
  logger: Logger;
};

export abstract class Plugin<PluginSchema, PluginCatalog> extends Pluggable {
  constructor(
    protected readonly props: PluginProps,
    opts?: any,
  ) {
    super();
  }

  /* Plugin lifecycle */
  public abstract start(): Promise<void>;

  public abstract stop(): Promise<void>;

  /* Schema validation */
  public abstract validateSchema(schema: PluginSchema): ValidationError[];

  public abstract describeSchema(schema: Readonly<PluginSchema>): PluginCatalog;
}
