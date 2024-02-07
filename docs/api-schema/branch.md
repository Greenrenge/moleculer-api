# Branch

```javascript
{
  branch: "master",
```

제거 할 수 없는 기본 브랜치는 `master` 브랜치입니다. 이외의 브랜치를 명시하여 브랜치를 생성하거나 업데이트 할 수 있습니다. 브랜치 관련 내용은 아래에서 다시 다룹니다.

**Load-Balancing**

동적으로 스키마를 수집하고 API를 업데이트하는 Gateway는 동일한 서비스 인스턴스가 분산 시스템에 여러개 존재할 때 문제를 드러냅니다.

예시

- `player` 서비스가 A, B 두 호스트에서 분산 시스템에 연결되어 디버깅되고 있다면, Gateway는 `player` 서비스 API 스키마를 A 호스트의 스키마, B 호스트의 스키마에 따라 빈번하게 변경하게 되어 원격지의 두 개발자는 디버깅에 문제를 겪습니다.
  - 해결 방법은 로컬에 전용 게이트웨이를 직접 실행하고 분산 시스템과의 연결\(eg. VPN 터널\)을 종료하는 방법입니다.
- `player` 서비스의 `get` 액션의 파라미터 및 응답 스펙이 A 호스트에서 디버깅 중인 경우, 클라이언트의 요청이 분산 시스템에 기존에 배포된 X 노드의 `player` 서비스의 `get` 액션으로 프록시되는 경우도 역시 문제가 됩니다.
  - 해결 방법으로 로드밸런싱의 우선 순위를 자신의 호스트로 강제하는 기능을 요청시 클라이언트 IP나 파라미터를 이용해 구현하는 방법이 있습니다. 이 방법은 이전 버전의 Gateway에서 시도되었으나 만족스럽지 않았습니다.
  - 또는 마찬가지로 로컬에 개발용 게이트웨이를 직접 실행하는 방법이지만, 분산 시스템에 연결해 배포된 타 서비스에 의존 할 필요가 있는 경우 불가능합니다.

위의 여러 전략을 실험해본 후 Gateway는 브랜치 및 태그을 통해 개발시 충돌 회피를 지원하고, 추가로 브랜치별 로드밸런싱 정책을 적용합니다.

- `call`
  - `master` 브랜치에서는 API 엔드포인트에 연결된 서비스 액션을 호출 할 때 `master`,`(none)` 브랜치에 API를 제공한 서비스 노드를 우선으로 요청을 프록시합니다.
    - 즉 이외\(eg. `dev`\)의 브랜치로의 트래픽을 방지합니다.
  - 이외의 브랜치\(eg. `dev`\)에서는 API 엔드포인트에 연결된 서비스 액션을 호출 할 때 `dev`,`master`,`(none)` 브랜치에 API를 제공한 서비스 노드를 우선으로 요청을 프록시합니다.
    - 즉 현재 브랜치\(eg. `dev`\)에 엔드포인트가 없는 경우 `master` 브랜치의 엔드포인트를 차선으로 찾습니다.
  - 이 규칙은 API 핸들러 생성시에 브랜치 전략에 따라 자연스럽게 적용됩니다.
- `publish`, `subscribe`
  - 이벤트 메시지 전달에는 서비스 브로커에 연결된 중앙 메시징 서비스의 정책을 그대로 따릅니다.

# Branch

```javascript
{
   branch: "master",
```

The default branch that cannot be removed is the `master` branch. You can create or update a branch by specifying a branch other than the branch. Branching is covered again below.

**Load-Balancing**

Gateways that dynamically collect schema and update APIs present problems when multiple instances of the same service exist in a distributed system.

example

- If the `player` service is connected to the distributed system on two hosts A and B and is being debugged, the Gateway frequently changes the `player` service API schema according to the schema of host A and host B, causing two remote developers causes problems in debugging.
  - A workaround is to run a dedicated gateway directly locally and terminate the connection\(eg. VPN tunnel\) with the distributed system.
- When the parameters and response specifications of the `get` action of the `player` service are being debugged on host A, and the client's request is proxied to the `get` action of the `player` service of the X node already deployed in the distributed system. This is also a problem.
  - As a solution, there is a way to implement a function that forces the priority of load balancing to one's own host by using the client IP or parameter when requesting. This method was tried in previous versions of Gateway but was not satisfactory.
  - Alternatively, you can run the development gateway directly locally, but this is not possible if you need to depend on other services deployed by connecting to a distributed system.

After experimenting with the various strategies above, Gateway supports conflict avoidance during development through branches and tags, and additionally applies a load balancing policy for each branch.

- `call`
  - When calling a service action connected to an API endpoint in the `master` branch, the request is proxyed with priority given to the service node that provided the API to the `master`, `(none)` branch.
    - In other words, prevent traffic to branches other than\(eg. `dev`\).
  - In branches other than \(eg. `dev`\), when calling a service action connected to an API endpoint, the service node that provided the API to the `dev`, `master`, and `(none)` branches is requested first. Proxy .
    - That is, if there is no endpoint in the current branch\(eg. `dev`\), the endpoint in the `master` branch is found as the next best option.
  - This rule is naturally applied according to the branch strategy when creating an API handler.
- `publish`, `subscribe`
  - Event message delivery follows the policy of the central messaging service connected to the service broker.
