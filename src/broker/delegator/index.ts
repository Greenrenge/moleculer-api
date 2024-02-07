import { ServiceBrokerDelegator } from "./delegator";
import { MoleculerServiceBrokerDelegator, MoleculerServiceBrokerDelegatorOptions } from "./moleculer";
export { ServiceBrokerDelegator };

type ServiceBrokerDelegatorClass = typeof ServiceBrokerDelegator;

interface ServiceBrokerDelegatorInterface extends ServiceBrokerDelegatorClass {}

// TODO: GREEN: Add other ServiceBrokerDelegator classes here, all available delegators should be listed here

export const ServiceBrokerDelegatorConstructors: any = {
  [MoleculerServiceBrokerDelegator.key]: MoleculerServiceBrokerDelegator as ServiceBrokerDelegatorInterface,
  // [OtherServiceBrokerDelegator.key]: OtherServiceBrokerDelegator as ServiceBrokerDelegatorInterface,
};

export type ServiceBrokerDelegatorConstructorOptions =
  | {
      [MoleculerServiceBrokerDelegator.key]: MoleculerServiceBrokerDelegatorOptions;
    } /* | {
  [OtherServiceBrokerDelegator.key]: OtherServiceBrokerDelegatorOptions;
}*/
  | {
      [key: string]: never;
    };
