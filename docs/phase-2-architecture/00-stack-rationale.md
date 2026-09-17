# 00 · Stack & Rationale

Phase 2 · Architecture | Status: awaiting sign-off

Every choice below is justified against this project's actual constraints — a small team, a
latency-sensitive market, and asynchronous money movement — rather than against general best
practice.

---

## 1. Summary

| Layer | Choice | One-line reason |
|---|---|---|
| Backend | **TypeScript · NestJS · modular monolith** | One language across the stack; module boundaries without distributed-systems tax |
| API style | **REST + OpenAPI 3.1** | Cacheable, debuggable on bad networks, trivially consumable by third parties |
| Database | **PostgreSQL 16** | Transactional integrity for orders, payments, inventory; JSONB covers flexible attributes |
| Cache / queue | **Redis 7** + **BullMQ** | Sessions, rate limits, read models, and the job queue that drives payment reconciliation |
| Search | **OpenSearch** | Portuguese analyzer with diacritic folding; faceting the catalogue needs |
| Object storage | **S3 + CloudFront** | Images, KYC documents, CSV exports |
| Web | **Next.js 15 (App Router)** | SSR is a requirement, not a preference — see §4 |
| Mobile | **React Native 0.76+ (New Arch, Hermes)** | Confirmed OQ-3 / D-02 |
| Shared code | **TypeScript monorepo (pnpm + Turborepo)** | The money-touching logic is written once |
| Infrastructure | **AWS `af-south-1`**, ECS Fargate, Terraform | Confirmed OQ-2 / D-16 |
| CI/CD | **GitHub Actions** | |

## 2. Backend: modular monolith, not microservices

**D-18.** A single deployable NestJS application, internally divided into modules with enforced
boundaries: `catalog`, `orders`, `payments`, `vendors`, `identity`, `delivery`, `settlements`,
`disputes`, `notifications`, `search`, `admin`.

### Why not microservices

The brief explicitly asks me not to default to microservices, and the honest answer is that they
would actively hurt here:

- **Distributed transactions are the core domain.** Placing an order touches inventory, orders,
  payments, and settlement atomically. In a monolith that is one Postgres transaction. Split across
  services it becomes a saga with compensating actions — and the failure mode of a broken saga is
  *money in the wrong place*, which is the one failure this product cannot afford.
- **Team size.** Microservices pay off when independent teams need independent deploy cadences.
  There are no independent teams here. The cost — service discovery, distributed tracing, per-service
  CI, contract testing, on-call surface — is paid immediately; the benefit arrives at an
  organisational scale this project will not reach for years.
- **Latency compounds.** In `af-south-1` every inter-service hop is real. A checkout that fans out
  across six services on a 3G client's request is slower for reasons the user cannot see.

### What we do instead

The boundaries that microservices would give us are enforced *inside* the monolith, so extraction
stays cheap if it is ever warranted:

- Each module exposes a public service interface; cross-module access goes through it, never through
  another module's repositories. Enforced by ESLint `no-restricted-imports` and a dependency-cruiser
  rule in CI.
- Each module owns its tables. No cross-module joins in application code — cross-module reads go
  through the owning module's service.
- Modules communicate asynchronously via the outbox pattern where the interaction is genuinely
  eventual (notifications, search indexing, analytics), and synchronously where it must be atomic
  (order placement).

**The one exception:** the **payment callback receiver** deploys as a separate, minimal service.
Provider webhooks must be reachable, fast, and independently scalable, and must keep working while
the main application is deploying or degraded. It does one thing — verify the signature, write to
the `payment_event` outbox, return 200 — and everything else happens asynchronously. This is a real
availability requirement, not an architectural preference: a webhook we fail to accept is a payment
we may never learn about.

## 3. API: REST over GraphQL

**D-19.** REST with OpenAPI 3.1, JSON, cursor pagination.

GraphQL's main advantage — clients fetching exactly the fields they need — is genuinely attractive
on a bandwidth-constrained market. It loses on three counts that matter more here:

1. **HTTP caching.** REST responses cache at CloudFront, in the service worker, and in the mobile
   HTTP cache by URL. That is the single largest data-saving lever we have (D-09), and GraphQL's
   single POST endpoint forfeits it. On this project, cacheability beats field selection.
2. **Debuggability on bad networks.** A failed REST call is a URL, a status code, and a body. Retry
   semantics are per-endpoint and obvious. Our retry queue (D-12) is far simpler to reason about
   against REST.
3. **Payload discipline is achievable without GraphQL.** Purpose-built response shapes
   (`ProductListItem` vs `ProductDetail`) get most of the benefit with none of the cost.

Over-fetching is handled by designing narrow list responses, not by pushing the problem to the
client.

## 4. Web: Next.js, and why SSR is a requirement

**D-20.** Next.js 15, App Router, React Server Components, deployed as a container on ECS (not
Vercel — keeps the whole system in one region and one IaC definition).

SSR is not a performance nicety here. Three hard requirements demand it:

1. **WhatsApp and Facebook link previews.** Primary discovery in this market is a shared link. A
   product URL must render Open Graph tags server-side or the share shows nothing, which kills the
   channel.
2. **Search indexing.** A young marketplace needs organic discovery.
3. **Time to first content on 3G.** A client-rendered SPA must download and execute JS before
   showing a product. Server-rendered HTML shows the product while the JS is still arriving.

ISR with on-demand revalidation for catalogue pages; client rendering only behind auth, where none
of the three requirements apply.

## 5. Database: PostgreSQL, single primary

**D-21.** Postgres 16 on RDS, Multi-AZ, with a read replica added when read load justifies it.

- Orders, payments, inventory, and settlements need **ACID guarantees and real foreign keys**.
  Every serious marketplace failure story is an eventual-consistency story about inventory or money.
- Postgres covers what we would otherwise reach for NoSQL to do: `JSONB` for per-category product
  attributes (with GIN indexes), arrays, and partial indexes.
- Row-level constraints encode business rules the application must not be able to violate — a
  negative `stock_quantity` should be impossible at the database level, not merely unlikely.

**Money is `BIGINT` centavos throughout.** Never `FLOAT`, never `NUMERIC` in application code paths
where a rounding mode could differ between web and mobile. A `CHECK (amount >= 0)` on every monetary
column.

### Where we deliberately add non-relational stores

| Store | Purpose | Why not Postgres |
|---|---|---|
| **Redis** | Sessions, OTP codes + attempt counters, rate limit buckets, cart read model, hot catalogue fragments | These are ephemeral, extremely high-write, and must not generate Postgres WAL. OTP rate limiting in particular is a per-request write. |
| **OpenSearch** | Catalogue search and faceting | Postgres full-text cannot do relevance tuning, faceted aggregation, and typo tolerance at once. Portuguese analyzer with diacritic folding matters: a search for `celular` must match `Celular`, and `bebe` must match `bebé`. |
| **S3** | Images, KYC documents, exports | Obvious |

OpenSearch is a **read model only** — never a source of truth. It is rebuildable from Postgres at
any time, and if it is down, catalogue browsing degrades to Postgres-backed category listings rather
than failing.

## 6. Mobile

React Native 0.76+, New Architecture, Hermes. Supporting choices:

| Concern | Choice | Reason |
|---|---|---|
| Navigation | React Navigation (native stack) | Native transitions; cheaper on low-end Android |
| Server state | TanStack Query + persisted cache | Gives us stale-while-revalidate, retry policy, and offline cache in one library — exactly the D-12 model |
| Local storage | MMKV | Substantially faster than AsyncStorage on entry-level devices |
| Offline queue | Custom, on MMKV | Must carry idempotency keys and be inspectable; no library matches our semantics |
| Images | `expo-image` | AVIF/WebP, disk cache, LQIP placeholders |
| Push | Firebase Cloud Messaging | Android-first (D-03); APNs via FCM for iOS |
| Build | Expo (prebuild / EAS) | Removes most native build maintenance without giving up native modules |

**Minimum supported:** Android 8 (API 26), iOS 15. Android 8 is deliberately low — it covers the
long tail of entry-level devices still in daily use here.

## 7. Monorepo layout

```
nhonga-marketplace/
├── apps/
│   ├── api/                 NestJS modular monolith
│   ├── webhooks/            Minimal payment-callback receiver (separate deploy)
│   ├── web/                 Next.js — storefront + vendor + admin
│   └── mobile/              React Native buyer app
├── packages/
│   ├── design-tokens/       ✅ built in Phase 1
│   ├── shared/              Money, locale, validation schemas, state machines, API types
│   ├── ui-web/              React components on the tokens
│   └── ui-mobile/           RN components on the tokens
├── infra/
│   ├── terraform/
│   └── docker/
└── docs/
```

**`packages/shared` is the point of the monorepo.** It holds `formatMZN`, cart and pricing
arithmetic, the order and payment state machines, Zod schemas shared by client validation and server
validation, and the generated API types. These are the places where a web/mobile divergence would
cost money, so they are written once and tested once.

## 8. What we are explicitly not using

| Rejected | Why |
|---|---|
| Kubernetes | ECS Fargate covers this workload with a fraction of the operational surface. Revisit at genuine scale. |
| Kafka | Postgres-backed outbox + BullMQ handles our event volume. Kafka is an operational commitment we cannot staff. |
| Serverless functions for the API | Cold starts are latency we cannot afford on an already-slow network, and Postgres connection management under Lambda is a known tax. |
| A separate BFF layer | The API serves two clients with similar needs. A BFF would be indirection without benefit at this size. |
| Prisma | Chosen against in favour of **Drizzle** — closer to SQL, materially better at the complex transactional queries in orders and settlements, and no separate query engine binary in the container. |
| Vercel / Netlify hosting | Keeps rendering in a different region from the database and outside our Terraform definition. |

---

**Next:** [01 · System Architecture](01-system-architecture.md)
