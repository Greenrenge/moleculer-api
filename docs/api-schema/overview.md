# Overview

## API Schema and Handler

### 1. Design Principle

Moleculer API Gateway는 아래 원칙을 기반으로 고안되었습니다.

- 분산 시스템안에서 유동적으로 작동합니다.
  - Persistence Layer를 갖지 않습니다.
- "분산 서비스 -&gt; API" 종속성을 최소화합니다.
  - 서비스 API 스키마는 JSON 텍스트입니다.
  - 분산 서비스 호출시 인증 등의 컨텍스트를 파라미터로 맵핑하도록 유도합니다.
- 확장 가능한 컴포넌트 패턴을 지향합니다.
  - 프로토콜 플러그인은 서버, 미들웨어, 스키마, 핸들러의 모든 부분을 확장합니다.
  - 접근 제어 정책은 프로토콜별 엔드포인트가 아닌 액션, 이벤트에 적용됩니다.
- 네트워킹 및 복원 패턴에 관여하지 않습니다.
  - 분산 서비스와 API Gateway는 어댑터\(Broker\)로 연결됩니다.
  - 분산 트랜잭션을 유도하거나 관여하지 않습니다.

아울러 분산 서비스 및 서비스 브로커에서 기대되는 패턴은 다음과 같습니다.

- 분산 서비스의 프로시저는 무상태를 지향합니다.
  - 프로시저는 인증 컨텍스트를 고려하지 않습니다.
  - 프로시저는 접근 제어를 고려하지 않습니다.
  - 프로시저는 가능한 멱등성을 갖도록 고려됩니다.
- 서비스 브로커는 분산 시스템을 위한 복원 패턴을 구성합니다.
  - 회로차단기
  - 격벽
  - 재시도
  - 요청 큐

### 2. API Schema

이하에서 **서비스 API 스키마**는 분산 환경의 부분적인 API 스키마를 의미합니다. **Gateway API 스키마**는 Gateway에서 통합된 API 스키마를 의미합니다.

서비스 API 스키마는 JSON 텍스트로 Gateway에 전달됩니다. 스키마 데이터의 직렬화 및 비직렬화는 MSA 라이브러리에 달렸습니다. 아래 예시에서는 Node.js 환경을 기준으로 서비스 API 스키마를 JavaScript 객체로 표기합니다.

#Overview

## API Schema and Handler

### 1. Design Principle

Moleculer API Gateway is designed based on the principles below:

- Operates fluidly in a distributed system.
  - Does not have a persistence layer.
- Minimize “Distributed Services -&gt; API” dependencies.
  - Service API schema is JSON text.
  - Encourages mapping of context, such as authentication, to parameters when calling a distributed service.
- Aim for an extensible component pattern.
  - Protocol plugins extend all parts of the server, middleware, schema, and handlers.
  - Access control policies apply to actions and events, not to protocol-specific endpoints.
- Not involved in networking and restoration patterns.
  - Distributed service and API Gateway are connected by adapter\(Broker\).
  - Does not induce or engage in distributed transactions.

Additionally, the patterns expected from distributed services and service brokers are as follows:

- The procedures of distributed services aim to be stateless.
  - The procedure does not take into account the authentication context.
  - The procedure does not take access control into account.
  - The procedures are considered to be as idempotent as possible.
- Service Broker configures resilience patterns for distributed systems.
  - Circuit breaker
  - Bulkhead
  - retry
  - Request Queue

### 2. API Schema

Hereinafter, **Service API Schema** refers to a partial API schema in a distributed environment. **Gateway API Schema** refers to the API schema integrated in Gateway.

The service API schema is passed to the Gateway as JSON text. Serialization and deserialization of schema data is up to the MSA library. In the example below, the service API schema is expressed as a JavaScript object based on the Node.js environment.
