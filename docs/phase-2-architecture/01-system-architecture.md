# 01 · System Architecture

Phase 2 · Architecture | Status: awaiting sign-off

---

## 1. System context

```mermaid
flowchart TB
    subgraph clients["Clientes"]
        M["App móvel<br/>React Native"]
        W["Web<br/>Next.js SSR"]
        VC["Consola do vendedor<br/>web responsivo"]
        AC["Consola admin<br/>web"]
    end

    subgraph edge["Edge · CloudFront"]
        CF["CDN<br/>imagens · estáticos · SSR cache"]
        WAF["AWS WAF<br/>rate limit · regras OWASP"]
    end

    subgraph core["AWS af-south-1 · VPC"]
        ALB["Application Load Balancer"]
        API["apps/api<br/>NestJS modular monolith<br/>ECS Fargate 2-8 tasks"]
        WH["apps/webhooks<br/>receptor de callbacks<br/>ECS Fargate 2 tasks"]
        NEXT["apps/web<br/>Next.js SSR<br/>ECS Fargate 2-6 tasks"]
        WORKER["Workers BullMQ<br/>reconciliação · notificações<br/>indexação · liquidações"]

        PG[("PostgreSQL 16<br/>RDS Multi-AZ")]
        RD[("Redis 7<br/>ElastiCache")]
        OS[("OpenSearch<br/>índice de catálogo")]
        S3[("S3<br/>imagens · KYC · exports")]
        SM["Secrets Manager"]
    end

    subgraph ext["Terceiros"]
        MP["M-Pesa<br/>Vodacom"]
        EM["e-Mola<br/>Movitel"]
        SMS["Gateway SMS"]
        FCM["Firebase FCM"]
    end

    M & W & VC & AC --> WAF --> CF
    CF --> ALB
    ALB --> API
    ALB --> NEXT
    NEXT --> API
    MP & EM -.->|"webhook assinado"| WH
    WH --> PG
    API --> PG & RD & OS & S3
    API --> SM
    WORKER --> PG & RD & OS
    WORKER -->|"queryStatus / disbursement"| MP & EM
    WORKER --> SMS & FCM
    API -->|"requestPayment"| MP & EM
```

**The webhook receiver is deliberately isolated.** Provider callbacks are the only inbound path we
do not control the timing of, and a callback we fail to accept may be a payment we never learn
about. It deploys separately, scales separately, and does almost nothing — verify signature, persist
the raw event, return 200. All interpretation happens asynchronously in a worker.

## 2. Module map

```mermaid
flowchart LR
    subgraph api["apps/api — modular monolith"]
        direction TB
        IDENT["identity<br/>OTP · sessões · RBAC"]
        CAT["catalog<br/>produtos · variantes<br/>categorias · atributos"]
        SRCH["search<br/>indexação · consulta"]
        CART["cart<br/>carrinho · preços"]
        ORD["orders<br/>pedidos · sub-pedidos<br/>máquina de estados"]
        PAY["payments<br/>provedores · callbacks<br/>reembolsos"]
        DELIV["delivery<br/>moradas · zonas · tarifas"]
        VEND["vendors<br/>KYC · lojas · staff"]
        SETL["settlements<br/>comissões · pagamentos"]
        DISP["disputes"]
        NOTIF["notifications<br/>push · SMS · email"]
        ADMIN["admin<br/>moderação · config · auditoria"]
    end

    CART --> CAT
    CART --> DELIV
    ORD --> CART
    ORD --> PAY
    ORD --> CAT
    ORD --> DELIV
    PAY -.->|evento| ORD
    ORD -.->|evento| NOTIF
    ORD -.->|evento| SETL
    DISP --> ORD
    DISP -.-> SETL
    SETL --> PAY
    CAT -.->|evento| SRCH
    VEND --> IDENT
    ADMIN --> VEND
    ADMIN --> DISP
```

Solid arrows are synchronous calls through a module's public service interface. Dotted arrows are
domain events delivered through the transactional outbox.

**Dependency rules, enforced in CI** by dependency-cruiser:

1. No module imports another module's `*.repository.ts` or entity files — only its
   `*.service.ts` public interface.
2. No cyclic dependencies between modules. Where two modules would need each other, the lower one
   emits an event instead (this is why `payments → orders` is an event, not a call).
3. `notifications`, `search`, and `settlements` are leaf consumers: nothing calls into them
   synchronously from the request path.

## 3. Request path: placing an order

The most important sequence in the system. Note precisely where the database transaction begins and
ends.

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant API as apps/api
    participant PG as Postgres
    participant PR as Provedor
    participant Q as BullMQ

    C->>API: POST /checkout {cartId, addressId, method}<br/>Idempotency-Key: uuid
    API->>PG: SELECT idempotency_key
    alt chave já vista
        PG-->>API: resposta guardada
        API-->>C: 200 (mesma resposta)
    end

    rect rgb(240,248,244)
    Note over API,PG: TRANSAÇÃO ÚNICA
    API->>PG: BEGIN
    API->>PG: SELECT ... FOR UPDATE nas variantes
    API->>PG: verificar stock e preços
    API->>PG: decrementar stock (reserva)
    API->>PG: INSERT order + sub_orders + order_items
    API->>PG: INSERT payment (INITIATED)
    API->>PG: INSERT outbox (order.created)
    API->>PG: INSERT idempotency_key
    API->>PG: COMMIT
    end

    API->>PR: requestPayment(...)  -- fora da transação
    PR-->>API: 202 {providerTxId}
    API->>PG: UPDATE payment → AWAITING_USER
    API-->>C: 202 {orderId, paymentId}

    Q->>Q: agendar reconciliação em 30s, 60s, 180s
    Note over Q,PR: se nenhum webhook chegar,<br/>o worker chama queryStatus()
```

Three points that matter:

- **The provider call happens outside the transaction.** Holding a Postgres transaction open across
  a network call to Vodacom would pin row locks for the duration of an unpredictable external
  request — the classic way to take down a database under load.
- **Stock is decremented at order creation, not at payment confirmation.** Reserving on creation can
  strand stock if payment fails; reserving on confirmation oversells. Overselling is worse: it
  breaks a promise already made to a buyer. Stranded stock is released by a worker when the payment
  reaches `FAILED` or `EXPIRED`.
- **Reconciliation is scheduled immediately**, at order-creation time. It does not depend on the
  webhook arriving, on the client staying connected, or on the user returning to the app.

## 4. The transactional outbox

Domain events are written to an `outbox` table **inside the same transaction as the state change**,
then relayed to BullMQ by a poller.

```mermaid
flowchart LR
    A["Transação de domínio<br/>UPDATE order + INSERT outbox"] --> B[("outbox<br/>unpublished")]
    B --> C["Relay poller<br/>a cada 500ms"]
    C --> D["BullMQ"]
    D --> E["Worker: notificações"]
    D --> F["Worker: indexação"]
    D --> G["Worker: liquidações"]
    C --> H[("outbox<br/>published_at set")]
```

Publishing directly to Redis from inside a transaction produces the two classic bugs: an event
published for a transaction that then rolls back (a notification for an order that does not exist),
or a committed transaction whose event was lost when the process died. The outbox makes event
publication exactly as durable as the state change it describes.

Consumers are **idempotent** and events carry a monotonic `sequence` per aggregate, because at-least
once delivery means a notification worker will occasionally see the same event twice.

## 5. Caching strategy

Directly serves the data-cost constraint (D-09). Four layers:

| Layer                | Contents                                                                   | TTL                                            | Invalidation                              |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Client (RN / SW)** | Catalogue pages, product details, order list                               | 7 days, stale-while-revalidate                 | ETag revalidation                         |
| **CloudFront**       | Images, static assets, SSR catalogue HTML                                  | Images 1 year (content-hashed); HTML 60s + SWR | On-demand invalidation on product publish |
| **Redis**            | Product detail read models, category trees, vendor profiles, homepage feed | 5–60 min                                       | Event-driven purge from the outbox        |
| **Postgres**         | Source of truth                                                            | —                                              | —                                         |

**Never cached:** cart contents, checkout, payment status, order status transitions, anything under
`/admin` or `/vendor`. Serving a stale payment status is exactly the failure that loses money.

Cache keys include the locale, so the PT and EN variants never cross-contaminate.

## 6. Deployment topology

```mermaid
flowchart TB
    subgraph vpc["VPC 10.0.0.0/16 · af-south-1"]
        subgraph pub["Subnets públicas (2 AZ)"]
            ALB["ALB :443"]
            NAT["NAT Gateway"]
        end
        subgraph priv["Subnets privadas de aplicação (2 AZ)"]
            T1["ECS: api"]
            T2["ECS: web"]
            T3["ECS: webhooks"]
            T4["ECS: workers"]
        end
        subgraph data["Subnets privadas de dados (2 AZ)"]
            RDS[("RDS Postgres<br/>Multi-AZ")]
            EC[("ElastiCache Redis<br/>replicação")]
            OSD[("OpenSearch<br/>2 nós")]
        end
    end
    ALB --> T1 & T2 & T3
    T1 & T2 & T3 & T4 --> RDS & EC & OSD
    T1 & T4 --> NAT --> INT(("Internet<br/>provedores · SMS · FCM"))
```

- Data subnets have **no route to the internet** in either direction. Security groups permit only
  the application security group on the specific port.
- Outbound calls to payment providers egress through the NAT gateway, which gives a **stable source
  IP** — several providers require IP allowlisting, so this is a functional requirement, not just
  hygiene.
- The webhook service accepts inbound traffic only from provider source ranges, enforced at the WAF
  and again in application middleware.

## 7. Scaling profile

Sized against A-10 (≈1,000 orders/day at launch) with headroom, and against the actual shape of
the load — which is spiky around paydays and holidays, not uniform.

| Service    | Baseline        | Max           | Trigger                                                         |
| ---------- | --------------- | ------------- | --------------------------------------------------------------- |
| `api`      | 2 tasks         | 8             | CPU > 65% or p95 latency > 400ms                                |
| `web`      | 2               | 6             | CPU > 65%                                                       |
| `webhooks` | 2               | 4             | Request count — kept generous; dropping a callback is expensive |
| `workers`  | 2               | 6             | Queue depth > 500                                               |
| RDS        | `db.t4g.medium` | → `m7g.large` | Vertical first; read replica when read load justifies it        |

**First bottleneck we expect:** the `SELECT ... FOR UPDATE` on product variants during checkout, if
a single popular SKU is bought concurrently. Mitigation is ordered lock acquisition by variant ID to
prevent deadlocks, plus a short lock timeout that surfaces as a clean "tente novamente" rather than
a hung request.

## 8. Observability

| Concern         | Tool                                                                     | Note                                                                |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Structured logs | Pino JSON → CloudWatch                                                   | Every log carries `requestId`, `userId`, `orderId` where applicable |
| Tracing         | OpenTelemetry → AWS X-Ray                                                | Provider calls and DB queries spanned separately                    |
| Errors          | Sentry                                                                   | Web, mobile, and API, with release tracking                         |
| Metrics         | CloudWatch + a Grafana dashboard                                         |                                                                     |
| Uptime          | Health checks on `/health` (liveness) and `/health/ready` (dependencies) |                                                                     |

**Business alarms that page someone**, distinct from infrastructure alarms:

- Payment success rate below 85% over 15 minutes — the leading indicator that a provider is down
- Any payment in `AWAITING_USER` for more than 15 minutes
- Outbox backlog above 1,000 unpublished rows
- Reconciliation job failure
- Settlement batch failure
- OTP send rate above the daily budget's hourly pro-rata — catches abuse and runaway cost together

**Financial logs are never sampled and are retained for seven years.** Sampling a payment log means
being unable to answer where a specific person's money went.

## 9. Failure modes and degradation

Designed behaviour when each dependency fails, rather than whatever happens by default:

| Failure                   | Behaviour                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenSearch down           | Search degrades to Postgres category listings; a banner says search is limited. Browsing continues.                                                                     |
| Redis down                | Cache misses fall through to Postgres. **OTP and rate limiting fail closed** — login is refused rather than left unprotected.                                           |
| One payment provider down | Marked unavailable at checkout; buyers are routed to the other wallet or COD. Circuit breaker opens after 5 consecutive failures, half-open retry after 60s.            |
| Both providers down       | COD only, stated plainly on the payment step.                                                                                                                           |
| SMS gateway down          | Push still delivers; SMS queues with a 24h TTL. **OTP login is blocked** and says so — it cannot silently half-work.                                                    |
| Postgres primary fails    | Multi-AZ failover, ~60–120s. API returns 503 with `Retry-After`; clients back off.                                                                                      |
| Webhook receiver down     | Providers retry on their own schedule; our reconciliation workers close the gap via `queryStatus()` regardless. This is why reconciliation does not depend on webhooks. |

---

**Next:** [02 · Data Model](02-data-model.md)
