import * as Moleculer from "moleculer";
import { Service } from "../../registry";
import { ServiceBrokerDelegatorProps } from "../delegator";
import { proxyMoleculerServiceDiscovery } from "./discover";

const serviceName = "$api";

export function createMoleculerServiceSchema(props: ServiceBrokerDelegatorProps): Moleculer.ServiceSchema {
  const discoveryMap = new Map<string, Service[]>(); // nodeId -> discovered Service[]
  const removeServiceFromDiscoveryMapAndEmitDisconnect = (ctx: Moleculer.Context) => {
    const node = (ctx.params as any).node as Moleculer.BrokerNode;
    const services = discoveryMap.get(node.id) || [];
    for (const service of services) {
      if (service.id === serviceName) {
        continue; // will not discover "this" services
      }
      props.emitServiceDisconnected(service, node.id);
    }
    discoveryMap.delete(node.id);
  };

  return {
    name: serviceName,
    events: {
      /* receive all events and broker */
      "**": (ctx: Moleculer.Context) => {
        const event = ctx.eventName;
        // skip internal events
        if (!event || event.startsWith("$")) {
          return;
        }

        const params = ctx.params;
        //ctx.eventGroups	Array<String>	Groups of event.
        //ctx.eventType	String	Type of event (“emit” or “broadcast”).

        const groups = ctx.eventGroups ? (Array.isArray(ctx.eventGroups) ? ctx.eventGroups : [ctx.eventGroups]) : ctx.eventType === "broadcastLocal" ? [serviceName] : [];
        const broadcast = ctx.eventType === "broadcast";

        let from;
        const nodeId = ctx.nodeID;
        const serviceId = ctx.service && (ctx.service.fullName || ctx.service.name || ctx.service.id);
        if (nodeId && serviceId) {
          from = `${nodeId}@${serviceId}`;
        }

        // broker event
        props.emitEvent({ event, params, groups, broadcast, from });
      },
      /* service discovery */
      "$node.updated": (ctx: any) => {
        //remove old service
        removeServiceFromDiscoveryMapAndEmitDisconnect(ctx);
        const node = (ctx.params as any).node as Moleculer.BrokerNode;
        // add latest services
        const latestServices = proxyMoleculerServiceDiscovery(node);
        discoveryMap.set(node.id, latestServices);
        for (const service of latestServices) {
          if (service.id === serviceName) {
            continue; // will not discover "this" services
          }
          props.emitServiceConnected(service);
        }
      },
      "$node.connected": (ctx: Moleculer.Context) => {
        const node = (ctx.params as any).node as Moleculer.BrokerNode;
        const services = proxyMoleculerServiceDiscovery(node);
        discoveryMap.set(node.id, services);
        for (const service of services) {
          if (service.id === serviceName) {
            continue; // will not discover "this" services
          }
          props.emitServiceConnected(service);
        }
      },
      "$node.disconnected": removeServiceFromDiscoveryMapAndEmitDisconnect,
    },
  };
}
