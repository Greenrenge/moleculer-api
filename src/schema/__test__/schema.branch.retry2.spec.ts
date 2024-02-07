import { sleep, getMoleculerServiceBroker, getSchemaRegistry, MoleculerServiceSchemaFactory, sleepUntil } from "../../test";

const moleculer = {
  namespace: "test-schema-branch-retry-2",
  transporter: {
    type: "TCP",
    options: {
      udpPeriod: 1,
    },
  },
};

const schema = getSchemaRegistry({
  logger: {
    level: "error",
    label: "gateway",
    silent: false /* YOU MIGHT MISS IT! */,
  },
  delegator: { moleculer: { ...moleculer, nodeID: "gateway" } },
});

const remoteWrong = getMoleculerServiceBroker({
  logger: { level: "error", label: "remote-wrong" },
  moleculer: { ...moleculer, nodeID: "remote-wrong" },
  services: [
    MoleculerServiceSchemaFactory.echo("master", "master-c", {
      protocol: {
        GraphQL: {
          typeDefs: `
            type Foo {
              foo: WrongTypeReference!
            }
          `,
          resolvers: {
            Query: {},
          },
        },
      },
    }),
  ],
});

const remote = getMoleculerServiceBroker({
  logger: { level: "error", label: "remote" },
  moleculer: { ...moleculer, nodeID: "remote" },
  services: [
    MoleculerServiceSchemaFactory.echo("master", "master-b", {
      protocol: {
        GraphQL: {
          typeDefs: `
            type Bar {
              foo: EarlyTypeReference!
            }
          `,
          resolvers: {
            Query: {},
          },
        },
      },
    }), // failed then succeed in retry
    MoleculerServiceSchemaFactory.echo("master", "master-a", {
      protocol: {
        GraphQL: {
          typeDefs: `
            type EarlyTypeReference {
              foo: String!
            }
          `,
          resolvers: {
            Query: {},
          },
        },
      },
    }), // succeed
  ],
});

jest.setTimeout(1000 * 20);

const schemaUpdated = jest.fn().mockName("listeners.updated.master");

beforeAll(async () => {
  await Promise.all([
    remoteWrong.start(),
    schema.start({
      updated: schemaUpdated,
      removed: jest.fn(),
    }),
  ]);
  await sleepUntil(() => {
    return schema.getBranch("master")!.services.length >= 1;
  });
  await remote.start();
  await sleepUntil(() => {
    return schema.getBranch("master")!.services.length >= 2;
  });
  await remoteWrong.stop();
  await sleepUntil(() => {
    return schema.getBranch("master")!.latestVersion.routes.length >= 6;
  });
});

describe("Schema registry integration retry test 2", () => {
  it("branch should gathered all services regardless of integration result except disconnected one", () => {
    const serviceIds = schema.getBranch("master")!.services.map((s) => s.id);
    expect(serviceIds).toEqual(expect.arrayContaining(["master-a", "master-b"]));
    expect(serviceIds).toHaveLength(2);
  });

  it("branch should retry merging failed integrations on succeed or skipped", () => {
    const routes = schema.getBranch("master")!.latestVersion.routes;
    expect(routes.length).toEqual(6); // graphql(3) +a +b + introspection
    expect(schemaUpdated).toHaveBeenCalledTimes(4); // created + initial +a +retry(b)
  });
});

afterAll(async () => {
  await Promise.all([schema.stop(), remote.stop()]);
});
