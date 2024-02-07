# GraphQL

#### B. GraphQL

GraphQL API 맵핑에는 `call`, `publish`, `subscribe`, `map` 커넥터를 이용 할 수 있습니다.

**TypeDefs**

```javascript
    GraphQL: {
      typeDefs: `
        """Soccer Player"""
        type Player implements Node {
          id: ID!
          email: String!
          name: String!
          photoURL: String
          position: String
          """A team player belongs to"""
          team: Team
        }

        extend type Query {
          """Current Player"""
          viewer: Player
          player(id: ID!): Player
        }

        extend type Subscription {
          playerMessage: String!
          playerUpdated: Player
        }
      `,
```

GraphQL 프로토콜에서 `typeDefs` 속성에 서비스에 필요한 정의\(`scalar`를 제외한 타입, 인터페이스, 열거형 등 모든 형태\)을 추가하거나 기존 타입\(API Gateway에서 제공하는 기본 타입과 분산 서비스에서 제공한 타입들\)을 확장 할 수 있습니다.

**Resolvers**

```javascript
      resolvers: {
```

이하 리졸버에 각 타입들의 필드를 `call`, `publish`, `subscribe`, `map` 커넥터에 맵핑합니다.

```javascript
        Player: {
```

리졸버가 할당되지 않은 필드들은 source 객체에서 동일한 이름의 속성으로부터 주입됩니다.

**Call**

```javascript
          team: {
            call: {
              action: "team.get",
              params: {
                id: "@source.teamId",
              },
            },
          },
```

GraphQL API의 `Query` 및 `Mutation` 타입의 필드들에는 `publish` 및 `call` 또는 `map` 커넥터를 이용 할 수 있습니다. `params` 맵핑에는 `@source`, `@args`, `@context`, `@info`를 이용 할 수 있습니다.

**Map**

```javascript
          position: `({ source, args, context, info }) => source.position.toUpperCase()`,
`
```

GraphQL 프로토콜에서 `map` 커넥터 \(Inline JavaScript Function String\)는 간략하게 `field: { map: <FN_STRING> }` 대신에 `field: <FN_STRING>` 방식으로 작성 할 수 있습니다.

```javascript
          // be noted that special field __isTypeOf got only three arguments
          __isTypeOf: `({ source, context, info }) => return source.someSpecialFieldForThisType != null`,

          // be noted that special field __resolveType got only three arguments
          __resolveType: `
            ({ source, context, info }) => {
              if (source.someSpecialFieldForThisType != null) {
                return "TypeA";
              } else {
                return "TypeB";
              }
            }
          `,
        },
```

위처럼 Union, Interface 구현 타입을 해석하기 위한 특수 필드에도 Inline JavaScript Function String를 사용합니다.

**Batched Call \(DataLoader\)**

```javascript
        Query: {
          viewer: {
            call: {
              action: "player.get",
              params: {
                id: "@context.user.player.id[]",
              },
            },
          },
          player: {
            call: {
              action: "player.get",
              params: {
                id: "@args.id[]",
              },
            },
          },
        },
```

위처럼 인증 정보를 포함한 `@context`나 GraphQL 필드 인자인 `@args`를 활용해 동일한 액션을 서로 다른 방식으로 맵핑 할 수 있습니다.

또한 `call` 메소드는 GraphQL 요청에서 발생하기 쉬운 N+1 쿼리를 방지하기 위해 요청을 배치로 처리 할 수 있도록 설계되었습니다. \(ref. [Dataloader](https://github.com/graphql/dataloader)\)

한 컨텍스트에서 여러번 호출되는 액션에 배칭을 지원하면 응답 속도를 획기적으로 높힐 수 있습니다. 배칭을 활성화하기 위해서는 `call` 커넥터의 `batchedParams` 필드에 배치 처리가 가능한 필드의 이름을 작성하고, 연결된 서비스 액션이 배열로 들어오는 인자 묶음을 처리 할 수 있도록 합니다.

```text
query {
  viewer {
    id
    email
  }
  one: player(id: 1) {
    id
    email
  }
  two: player(id: 2) {
    id
    email
  }
  three: player(id: 3) {
    id
    email
  }
}
```

위와 같은 GraphQL 요청은 `player.get` 액션을 `{ id: [context.user.player.id, 1, 2, 3], ...(other common params) }` 페이로드와 함께 한번만 호출하게 됩니다. 연결된 액션이 `[{ ... }, { ... }, { ... }, { ... }]` 묶음으로 응답을 주면 각 필드에 해당하는 응답이 할당됩니다.

만약 `id: 3`인 플레이어가 없는 경우 배치 요청을 처리하는 과정에서 에러를 발생시켜 제어 흐름을 멈추는 대신에, 에러를 발생키지않고 배치 응답에 포함시키고 나머지 제어 흐름을 마무리합니다. `[{ ... }, { ... }, { ... }, { message: "...", isBatchError: true, ... }]` 처럼 `isBatchError: true` 속성을 갖는 에러 객체를 응답에 포함합니다.

**Subscribe**

```javascript
        Subscription: {
          playerMessage: {
            subscribe: {
              events: ["player.message"],
            },
          },
```

GraphQL API의 `Subscription` 타입의 필드에서는 `subscribe` 커넥터를 사용 할 수 있습니다. `params` 맵핑에는 마찬가지로 `@source`, `@args`, `@context`, `@info`를 이용 할 수 있습니다. `@source`에 이벤트 객체가 맵핑됩니다.

`@source` 객체는 `{ event, payload }`로 구성됩니다. Broker에 따라 기타 속성이 추가 될 수 있습니다.

```javascript
          playerMessage: {
            subscribe: {
              events: ["player.message"],
              map: `({ source, args, context, info }) => source.payload.message`,
            },
          },
        },
      },
    },
```

`subscribe` 커넥터에서는 위처럼 수신된 이벤트 페이로드를 다시 `map` 커넥터로 변환 할 수 있습니다. `subscribe` 커넥터 안에서 `map` 커넥터가 사용되지 않는 경우 이벤트 객체 전체\(`source`\)를 반환합니다.

#GraphQL

#### B. GraphQL

The `call`, `publish`, `subscribe`, and `map` connectors can be used for GraphQL API mapping.

**TypeDefs**

```javascript
     GraphQL: {
       typeDefs: `
         """Soccer Player"""
         type Player implements Node {
           id: ID!
           email: String!
           name: String!
           photoURL: String
           position: String
           """A team player belongs to"""
           team: Team
         }

         extend type Query {
           """Current Player"""
           viewer: player
           player(id: ID!): Player
         }

         extend type Subscription {
           playerMessage: String!
           playerUpdated: Player
         }
       `,
```

In the GraphQL protocol, add definitions required for the service (all types, interfaces, enumerations, etc. except `scalar`) to the `typeDefs` property or add existing types (basic types provided by API Gateway and distributed services). types\) can be expanded.

**Resolvers**

```javascript
       resolvers: {
```

Below, the fields of each type are mapped to the `call`, `publish`, `subscribe`, and `map` connectors in the resolver.

```javascript
         Player: {
```

Fields that do not have a resolver assigned are injected from a property of the same name on the source object.

**Call**

```javascript
           team: {
             call: {
               action: "team.get",
               params: {
                 id: "@source.teamId",
               },
             },
           },
```

You can use the `publish` and `call` or `map` connectors for `Query` and `Mutation` type fields of the GraphQL API. `@source`, `@args`, `@context`, and `@info` can be used for `params` mapping.

**Map**

```javascript
           position: `({ source, args, context, info }) => source.position.toUpperCase()`,
`
```

In the GraphQL protocol, the `map` connector \(Inline JavaScript Function String\) can be simply written as `field: <FN_STRING>` instead of `field: { map: <FN_STRING> }`.

```javascript
           // be noted that special field __isTypeOf got only three arguments
           __isTypeOf: `({ source, context, info }) => return source.someSpecialFieldForThisType != null`,

           // be noted that special field __resolveType got only three arguments
           __resolveType: `
             ({ source, context, info }) => {
               if (source.someSpecialFieldForThisType != null) {
                 return "TypeA";
               } else {
                 return "TypeB";
               }
             }
           `,
         },
```

As above, Inline JavaScript Function String is also used for special fields to interpret Union and Interface implementation types.

**Batched Call \(DataLoader\)**

```javascript
         Query: {
           viewer: {
             call: {
               action: "player.get",
               params: {
                 id: "@context.user.player.id[]",
               },
             },
           },
           player: {
             call: {
               action: "player.get",
               params: {
                 id: "@args.id[]",
               },
             },
           },
         },
```

As above, the same action can be mapped in different ways by using `@context` containing authentication information or `@args`, a GraphQL field argument.

Additionally, the `call` method is designed to allow requests to be processed in batches to avoid the N+1 queries that are prone to occur in GraphQL requests. \(ref. [Dataloader](https://github.com/graphql/dataloader)\)

Supporting batching for actions that are called multiple times in one context can dramatically increase response speed. To activate batching, write the name of a field capable of batch processing in the `batchedParams` field of the `call` connector and allow the connected service action to process the argument bundle coming as an array.

```text
query {
   viewer {
     id
     email
   }
   one: player(id: 1) {
     id
     email
   }
   two: player(id: 2) {
     id
     email
   }
   three: player(id: 3) {
     id
     email
   }
}
```

A GraphQL request like the above will call the `player.get` action only once with a payload of `{ id: [context.user.player.id, 1, 2, 3], ...(other common params) }` . If the connected action provides a response in a group of `[{ ... }, { ... }, { ... }, { ... }]`, the corresponding response is assigned to each field.

If there is no player with `id: 3`, instead of raising an error and stopping the control flow while processing the batch request, the error is not raised and is included in the batch response and the remaining control flow is completed. An error object with the `isBatchError: true` property, such as `[{ ... }, { ... }, { ... }, { message: "...", isBatchError: true, ... }]` Include in your response.

**Subscribe**

```javascript
         Subscription: {
           playerMessage: {
             subscribe: {
               events: ["player.message"],
             },
           },
```

You can use the `subscribe` connector in a `Subscription` type field in the GraphQL API. Similarly, `@source`, `@args`, `@context`, and `@info` can be used for `params` mapping. The event object is mapped to `@source`.

A `@source` object consists of `{ event, payload }`. Other properties may be added depending on the broker.

```javascript
           playerMessage: {
             subscribe: {
               events: ["player.message"],
               map: `({ source, args, context, info }) => source.payload.message`,
             },
           },
         },
       },
     },
```

In the `subscribe` connector, the received event payload can be converted back to the `map` connector as above. If the `map` connector is not used within the `subscribe` connector, it returns the entire event object\(`source`\).
