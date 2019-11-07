import { APIGateway } from "./gateway";

const gateway = new APIGateway({
  brokers: [
    {
      moleculer: {
        namespace: "dev-gateway",
        transporter: {
          type: "TCP",
          udpPeriod: 1,
        },
        services: [
          {
            name: "file",
            metadata: {
              api: {
                branch: "master",
                protocol: {
                  REST: {
                    description: "..",
                    basePath: "/file",
                    routes: [
                      {
                        method: "POST",
                        path: "/",
                        call: {
                          action: "foo.noop",
                          params: {
                            file: "@body.file",
                          },
                          map: `({ params }) => params.file`,
                        },
                      },
                    ],
                  },
                },
                policy: {},
              },
            },
          },
          {
            name: "foo",
            metadata: {
              api: {
                branch: "master",
                protocol: {
                  REST: {
                    description: "test..",
                    basePath: "/foo",
                    routes: [
                      {
                        method: "GET",
                        path: "/bar",
                        map: `() => { throw new Error("what an error"); }`,
                      },
                      {
                        method: "GET",
                        path: "/:id",
                        call: {
                          action: "foo.get",
                          params: {},
                        },
                      },
                      {
                        method: "GET",
                        path: "/:a/:b/:c?",
                        map: `(args) => args`,
                      },
                    ],
                  },
                  GraphQL: {
                    description: "blablabla",
                    typeDefs: `
                      interface Node {
                        id: String
                      }
                      type Foo implements Node {
                        id: String
                      }
                      extend type Query {
                        foo(id: ID!): Foo
                      }
                      extend type Mutation {
                        uploadFile(file: Upload!): File!
                      }
                      type File {
                        mimetype: String
                        encoding: String
                        filename: String
                      }
                    `,
                    resolvers: {
                      Foo: {
                        id: `({ source }) => source.id`,
                        __isTypeOf: `({ source }) => source && source.__isFoo`,
                      },
                      Query: {
                        foo: {
                          call: {
                            action: "foo.get",
                            params: {
                              id: "@args.id[]",
                            },
                            map: `({ response }) => ({ ...response, __isFoo: true })`,
                          },
                          ignoreError: true,
                        },
                      },
                      Mutation: {
                        uploadFile: {
                          call: {
                            action: "foo.noop",
                            params: {
                              file: "@args.file",
                            },
                            map: `({ params }) => params.file`,
                          },
                        },
                      },
                    },
                  },
                },
                policy: {},
              },
            },
            actions: {
              get: {
                params: {
                  id: ["string", {
                    type: "array",
                    items: "string",
                  }],
                },
                handler(ctx) {
                  const id = ctx.params!.id;
                  if (Array.isArray(id)) { // batching
                    // tslint:disable-next-line:no-shadowed-variable
                    return id.map(id => ({id}));
                  }
                  return {id}; // single
                },
              },
              noop(ctx) {
              },
            },
          },
        ],
      },
    },
  ],
  schema: {
    protocol: {
      GraphQL: {
        subscriptions: {},
      },
    },
    branch: {
      maxVersions: 1,
    },
  },
  server: {
    update: {
      debouncedSeconds: 0,
    },
    protocol: {
      http: {
        port: 8080,
      },
    },
    middleware: [
      {
        cors: {
          origin: [
            "https://www.google.com",
          ],
        },
      },
    ],
  },
  logger: {
    winston: {level: "info"},
  },
});

(async () => {
  await gateway.start();
})();
