# REST

#### A. REST

REST API 맵핑에는 `subscribe`를 제외한 `call`, `publish`, `map` 커넥터를 이용 할 수 있습니다.

```javascript
    REST: {
      basePath: "/players",
      description: "player service REST API",
      routes: [
```

`basePath`를 기반으로 이하 REST 엔드포인트가 생성됩니다.

`description`은 문서 생성시 활용되며 Markdown을 지원합니다 \(옵션\).

**Call**

```javascript
        {
          method: "GET",
          path: "/:id",
          deprecated: false,
          description: "Get player information by id",
          call: {
            action: "player.get",
            params: {
              id: "@path.id",
            },
          },
        },
```

`GET /players/1` 요청이 `player.get` 액션을 `{ id: 1 }` 페이로드와 함께 호출하고 성공시 그 결과를 반환합니다.

`depreacted`는 문서 생성시 활용됩니다 \(옵션\).

라우트 path를 구성하는 규칙은 [path-to-regexp](https://github.com/pillarjs/path-to-regexp#parameters)를 참고 할 수 있습니다.

```javascript
        {
          method: "GET",
          path: "/me",
          deprecated: false,
          description: "Get player information of mine",
          call: {
            action: "player.get",
            params: {
              id: "@context.user.player.id",
            },
          },
        },
```

`GET /players/me` 요청이 `player.get` 액션을 `{ id: <인증 컨텍스트의 player.id> }` 정보로부터 페이로드와 함께 호출하고 성공시 그 결과를 반환합니다.

**Map**

```javascript
        {
          method: "GET",
          path: "/me",
          deprecated: false,
          description: "Get player information of mine",
          map: `({ path, query, body, context }) => context.user.player`,
        },
```

또는 `map` 커넥터 \(Inline JavaScript Function String\)를 통해 인증 컨텍스트의 `player` 객체를 바로 반환 할 수 있습니다. 이후에 다시 다루는 Inline JavaScript Function String은 API Gateway의 Node.js VM 샌드박스에서 해석됩니다.

**Publish**

```javascript
        {
          method: "POST",
          path: "/message",
          deprecated: false,
          description: "Push notifications to all players",
          publish: {
            event: "player.message",
            broadcast: false,
            params: {
              userId: "@context.user.player.id",
              message: "@body.message",
            },
          },
        },
```

`POST /players/1` \(body: `{ message: "blabla" }`\) 요청은 `player.message` 이벤트를 `{ userId: id: <인증 컨텍스트의 player.id>, message: "blabla" }` 페이로드와 함께 `publish`하고 성공시 발송된 페이로드를 응답합니다.

```javascript
      ],
    },
```

**Params**

REST API의 `params` 맵핑에는 `@path`, `@body`, `@query`, `@context` 객체를 이용 할 수 있습니다.

```javascript
// @body 객체 전체를 페이로드로 전달하거나 스트림을 전달 할 때 이용됩니다.
params: "@body",

// @ 문자열로 시작되지 않는 값들은 해석되지 않고 그대로 전달됩니다.
params: {
  foo: "@path.foo", // will bar parsed
  bar: "query.bar", // will be "query.bar"
  zzz: ["any", { obj: "ject", can: "be", "use": 2 }],
},

// 항상 string 타입을 갖는 @query, @path 객체의 속성들에 한해서 타입을 boolean이나 number로 변환 할 수 있습니다.
params: {
  foo: "@path.foo:number",
  bar: "@query.bar:boolean",
},
```

####

#REST

#### A. REST

For REST API mapping, you can use the `call`, `publish`, and `map` connectors except `subscribe`.

```javascript
     REST: {
       basePath: "/players",
       description: "player service REST API",
       routes: [
```

The following REST endpoints are created based on `basePath`.

`description` is used when creating a document and supports Markdown \(option\).

**Call**

```javascript
         {
           method: "GET",
           path: "/:id",
           deprecated: false,
           description: "Get player information by id",
           call: {
             action: "player.get",
             params: {
               id: "@path.id",
             },
           },
         },
```

The `GET /players/1` request calls the `player.get` action with a `{ id: 1 }` payload and returns the result if successful.

`depreacted` is used when creating a document \(option\).

You can refer to [path-to-regexp](https://github.com/pillarjs/path-to-regexp#parameters) for the rules for configuring the route path.

```javascript
         {
           method: "GET",
           path: "/me",
           deprecated: false,
           description: "Get player information of mine",
           call: {
             action: "player.get",
             params: {
               id: "@context.user.player.id",
             },
           },
         },
```

A `GET /players/me` request calls the `player.get` action with a payload from the `{ id: <player.id in the authentication context> }` information and returns the result if successful.

**Map**

```javascript
         {
           method: "GET",
           path: "/me",
           deprecated: false,
           description: "Get player information of mine",
           map: `({ path, query, body, context }) => context.user.player`,
         },
```

Alternatively, you can directly return the `player` object in the authentication context via the `map` connector \(Inline JavaScript Function String\). Inline JavaScript Function Strings, which we return to later, are interpreted in API Gateway's Node.js VM sandbox.

**Publish**

```javascript
         {
           method: "POST",
           path: "/message",
           deprecated: false,
           description: "Push notifications to all players",
           publish: {
             event: "player.message",
             broadcast: false;
             params: {
               userId: "@context.user.player.id",
               message: "@body.message",
             },
           },
         },
```

The `POST /players/1` \(body: `{ message: "blabla" }`\) request sends the `player.message` event to `{ userId: id: <player.id in the authentication context>, message: "blabla " }` `publish` with a payload and respond with the sent payload upon success.

```javascript
       ],
     },
```

**Params**

`@path`, `@body`, `@query`, and `@context` objects can be used for `params` mapping of REST API.

```javascript
// Used when passing the entire @body object as a payload or sending a stream.
params: "@body",

// Values that do not start with the @ string are not interpreted and are passed as is.
params: {
   foo: "@path.foo", // will bar parsed
   bar: "query.bar", // will be "query.bar"
   zzz: ["any", { obj: "ject", can: "be", "use": 2 }],
},

// Only properties of @query and @path objects that always have string type can be converted to boolean or number.
params: {
   foo: "@path.foo:number",
   bar: "@query.bar:boolean",
},
```

####
