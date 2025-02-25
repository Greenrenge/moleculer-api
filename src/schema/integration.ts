import { Reporter, Service, ServiceAction } from "../broker";
import { ValidationError } from "../interface";
import { Branch } from "./branch";
import { ServiceCatalog } from "./catalog";
import { ServiceAPISchema } from "./index";
import { Version } from "./version";

export type ServiceAPIIntegrationSource = {
  schema: Readonly<ServiceAPISchema>;
  service: Readonly<Service>;
  schemaHash: string;
  reporter: Readonly<Reporter>;
};

type ServiceAPIIntegrationProps = {
  type: "add" | "remove";
  source: ServiceAPIIntegrationSource;
  serviceCatalog: ServiceCatalog;
};

export class ServiceAPIIntegration {
  public static readonly Type = { Add: "add" as const, Remove: "remove" as const };
  public static readonly Status = { Queued: "queued" as const, Failed: "failed" as const, Succeed: "succeed" as const, Skipped: "skipped" as const };
  private static readonly StatusColor = { queued: "dim", failed: "red", succeed: "cyan", skipped: "dim" };
  private $status: "queued" | "failed" | "succeed" | "skipped";
  private $errors: ValidationError[] | null;

  constructor(protected readonly props: ServiceAPIIntegrationProps) {
    this.$status = ServiceAPIIntegration.Status.Queued;
    this.$errors = null;
  }

  public clone(): Readonly<ServiceAPIIntegration> {
    return new ServiceAPIIntegration(this.props);
  }

  public toString(): string {
    return `(${this.type === ServiceAPIIntegration.Type.Add ? "+" : "-"}) ${this.service} ${this.status}`;
  }

  public get information() {
    return {
      type: this.type,
      status: this.status,
      hash: this.schemaHash,
      schema: this.schema,
      service: this.service.id,
    };
  }

  public get type() {
    return this.props.type;
  }

  public get schema() {
    return this.props.source.schema;
  }

  public get schemaHash() {
    return this.props.source.schemaHash;
  }

  public get service(): Readonly<Service> {
    return this.props.source.service;
  }

  public get reporter(): Readonly<Reporter> {
    return this.props.source.reporter;
  }

  public get status() {
    return this.$status;
  }

  public findAction(actionId: string): Readonly<ServiceAction> | null {
    return this.props.serviceCatalog.findAction(actionId);
  }

  public setFailed(branch: Readonly<Branch>, version: Readonly<Version>, errors: ReadonlyArray<Readonly<ValidationError>>): void {
    this.$errors = [...errors];
    this.$status = ServiceAPIIntegration.Status.Failed;
    version.addIntegrationHistory(this);
    this.props.source.reporter.error({
      message: "gateway has been failed to updated",
      branch: branch.toString(),
      version: version.toString(),
      integrations: version.integrations.map((int) => (int.schemaHash === this.schemaHash ? int.toString() : int.service.toString())),
      errors,
    });
  }

  public setSucceed(branch: Readonly<Branch>, version: Readonly<Version>, updates: Readonly<string[]>): void {
    this.$status = ServiceAPIIntegration.Status.Succeed;
    version.addIntegrationHistory(this);
    this.props.source.reporter.info(
      {
        message: "gateway has been updated successfully",
        branch: branch.toString(),
        version: {
          from: version.parentVersion && version.parentVersion.toString(),
          to: version.toString(),
        },
        integrations: version.integrations
          .filter((int) => int.status === ServiceAPIIntegration.Status.Succeed && int.type === ServiceAPIIntegration.Type.Add)
          .map((int) => {
            if (version.parentVersion && version.parentVersion.integrations.includes(int)) {
              return int.service.toString();
            }
            return int.toString();
          }),
        updates,
      },
      "integrated:" + branch.toString(),
    );
  }

  public get errors() {
    return this.$errors;
  }

  public setSkipped(branch: Readonly<Branch>, version: Readonly<Version>): void {
    this.$status = ServiceAPIIntegration.Status.Skipped;
    version.addIntegrationHistory(this);
    this.props.source.reporter.info(
      {
        message: "gateway found no changes",
        branch: branch.toString(),
        version: version.toString(),
      },
      "integration-skipped:" + branch.toString(),
    );
  }

  public reportRemoved(branch: Readonly<Branch>, version: Readonly<Version>): void {
    this.props.source.reporter.info(
      {
        message: "gateway removed given integrated version",
        branch: branch.toString(),
        version: version.toString(),
      },
      "integration-removed:" + branch.toString(),
    );
  }
}
