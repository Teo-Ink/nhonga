# Nhonga — Multi-Vendor Marketplace for Mozambique

> **Name:** "Nhonga" — chosen 2026-09-16, replacing the earlier codename "Banca". Not yet
> trademark-cleared — see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) OQ-1. Still cheap to change:
> it lives in one tokens file and the i18n string bundles.

A multi-vendor e-commerce marketplace built for Mozambican buyers and sellers: Portuguese-first,
mobile-money-first, and engineered for 3G connectivity on low-end Android hardware.

## Phase status

| Phase                                            | Status                                                                                              | Artifact                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **1 — Design**                                   | ✅ Signed off 2026-09-15                                                                            | `docs/phase-1-design/` + published design-system prototype  |
| **2 — Architecture**                             | ✅ Signed off 2026-09-16                                                                            | `docs/phase-2-architecture/` + `apps/api/openapi.yaml`      |
| **3a — Build: money core**                       | ✅ **171/171 tests passing**, typechecks clean                                                      | `packages/shared/`, `apps/api/src/modules/payments/`        |
| **3b — Build: schema, checkout, reconciliation** | ✅ Typechecks; migration generates (28 tables, 81 CHECK constraints). **Untested — needs Postgres** | `apps/api/src/db/schema/`, `apps/api/src/modules/checkout/` |
| 3c — Build: HTTP layer, auth, vendor/admin       | ⏸                                                                                                  | —                                                           |
| 3d — Build: web + mobile clients                 | ⏸                                                                                                  | —                                                           |
| 4 — Test                                         | ⏸                                                                                                  | —                                                           |
| 5 — Deploy prep                                  | ⏸                                                                                                  | —                                                           |

## Phase 1 deliverables

| Document                                                                               | What it covers                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`00-product-context.md`](docs/phase-1-design/00-product-context.md)                   | Market constraints, personas, scope boundaries, assumption register                 |
| [`01-information-architecture.md`](docs/phase-1-design/01-information-architecture.md) | Sitemap, navigation model, taxonomy, URL/route scheme, entity map                   |
| [`02-user-flows.md`](docs/phase-1-design/02-user-flows.md)                             | Buyer, vendor, and admin journeys incl. the payment state machine                   |
| [`03-design-system.md`](docs/phase-1-design/03-design-system.md)                       | Colour, type, spacing, component inventory, accessibility rules                     |
| [`04-key-screens.md`](docs/phase-1-design/04-key-screens.md)                           | Layout specs for the 14 screens that define the product                             |
| [`05-states-and-connectivity.md`](docs/phase-1-design/05-states-and-connectivity.md)   | Empty / error / loading / offline states as first-class designs                     |
| [`packages/design-tokens/`](packages/design-tokens/)                                   | Machine-readable tokens (JSON + CSS) — the single source shared by web and mobile   |
| [Rendered prototype](https://claude.ai/artifact/QEyDuWMESYPC5xorCAJUL7)                | Live design system + five key screens, light and dark, at the 360px reference width |

## Phase 2 deliverables

| Document                                                                               | What it covers                                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`00-stack-rationale.md`](docs/phase-2-architecture/00-stack-rationale.md)             | Every technology choice justified, with rejections recorded                   |
| [`01-system-architecture.md`](docs/phase-2-architecture/01-system-architecture.md)     | Context and module diagrams, request paths, outbox, caching, failure modes    |
| [`02-data-model.md`](docs/phase-2-architecture/02-data-model.md)                       | ERD, core DDL, snapshots, audit log, encryption, retention                    |
| [`03-api-contract.md`](docs/phase-2-architecture/03-api-contract.md)                   | Conventions, rate limits, endpoint notes                                      |
| [`apps/api/openapi.yaml`](apps/api/openapi.yaml)                                       | The machine-readable contract — 20 endpoints, 30 schemas                      |
| [`04-payments-architecture.md`](docs/phase-2-architecture/04-payments-architecture.md) | Provider interface, mock design, **production swap runbook**                  |
| [`05-security-architecture.md`](docs/phase-2-architecture/05-security-architecture.md) | Threat model, OWASP coverage, Mozambican regulatory flags                     |
| [`06-infrastructure.md`](docs/phase-2-architecture/06-infrastructure.md)               | Terraform layout, CI/CD, rollback, cost estimate, store checklists            |
| [Architecture overview](https://claude.ai/artifact/K4HqizwEDR7eATwUKbqTDe)             | Shareable summary — diagrams, the production swap runbook, cost, and blockers |

## Phase 3a deliverables — the money core

Written first because this is where a web/mobile divergence or a rounding error costs real money.

| Module                                                                                               | What it holds                                                                          |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`packages/shared/src/money.ts`](packages/shared/src/money.ts)                                       | Branded integer centavos, `formatMZN`, basis-point rates, largest-remainder allocation |
| [`packages/shared/src/phone.ts`](packages/shared/src/phone.ts)                                       | MSISDN normalisation, operator detection, wallet pre-selection                         |
| [`packages/shared/src/state-machines/payment.ts`](packages/shared/src/state-machines/payment.ts)     | Payment lifecycle, idempotent transitions, `EXPIRED → PAID`                            |
| [`packages/shared/src/state-machines/sub-order.ts`](packages/shared/src/state-machines/sub-order.ts) | Fulfilment lifecycle, actor authorisation, order-status rollup                         |
| [`packages/shared/src/pricing/cart.ts`](packages/shared/src/pricing/cart.ts)                         | Vendor grouping, totals, discount distribution, settlement breakdown                   |
| [`apps/api/src/modules/payments/`](apps/api/src/modules/payments/)                                   | Provider interface, mock wallet, COD, registry                                         |

## Phase 3b deliverables — schema and the order path

| Module                                                                                   | What it holds                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/db/schema/`](apps/api/src/db/schema/)                                              | The Phase 2 data model as Drizzle DDL — 22 tables with the `CHECK` constraints that make overselling and unbalanced totals impossible to commit      |
| [`checkout.service.ts`](apps/api/src/modules/checkout/checkout.service.ts)               | The single transaction: lock → validate → reserve stock → create order + sub-orders → create payment → outbox. Provider call deliberately outside it |
| [`payment-event.processor.ts`](apps/api/src/modules/payments/payment-event.processor.ts) | Applies callbacks and reconciliation results through one shared path, with amount verification and duplicate handling                                |
| [`reconciliation.worker.ts`](apps/api/src/modules/payments/reconciliation.worker.ts)     | Four sweeps, including the late sweep that honours a post-expiry approval and the one that releases stranded stock                                   |

## Verification status

Run on 2026-09-16, after installing Node 24.19.0 and pnpm 9.12.0.

| Check                                           | Result                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| `pnpm test` (turbo, both packages)              | ✅ **171/171 passing** — 145 shared, 26 payments     |
| `tsc --noEmit` on `@nhonga/shared`              | ✅ clean                                             |
| `tsc --noEmit` on `@nhonga/api`                 | ✅ clean (13 source files)                           |
| `drizzle-kit generate`                          | ✅ 28 tables, 81 CHECK constraints, 700 lines of SQL |
| `redocly lint openapi.yaml`                     | ✅ valid — 0 errors, 37 style warnings               |
| Checkout / processor / reconciliation behaviour | ❌ **untested** — needs a live Postgres (no Docker)  |

Three real defects were found and fixed by running this, all in configuration and contract rather
than in logic:

1. **`apps/api/tsconfig.json`** aliased `@nhonga/shared` to its source, pulling it into the API's
   own compilation and violating `rootDir`. Replaced with a TypeScript project reference, and
   `@nhonga/shared` now publishes from `dist`.
2. **`drizzle.config.ts`** pointed at TypeScript source; drizzle-kit's loader cannot resolve the
   `.js` specifiers Node ESM requires. Now generates from compiled output, so migrations come
   from exactly the code that ships.
3. **`openapi.yaml`** had 10 spec errors: eight unquoted flow-mapping descriptions containing
   commas (YAML parsed the tail as a bogus key) and two uses of `nullable: true`, which OpenAPI
   3.1 removed in favour of `type: [x, 'null']`.

Remaining warnings are stylistic — 21 missing `operationId`s and 9 missing 4xx responses. Those
land in 3c alongside the routes themselves.

Running records:

- [`DECISIONS.md`](DECISIONS.md) — every material choice and why
- [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) — what is blocked on you or on a third party

## ⚠️ Read this before Phase 2

**M-Pesa and e-Mola have no self-service public API.** Production credentials require signed
merchant agreements with Vodacom Moçambique and Movitel respectively. I cannot obtain these.
Phase 1 designs the payment layer around a provider-agnostic interface, and Phase 3 will build it
against a mock provider that reproduces the real push→approve→webhook flow so checkout is fully
testable today. The full procurement checklist is [OQ-4 through OQ-9](OPEN_QUESTIONS.md).

Three other items also depend on business relationships you must secure: a settlement bank
account, NUIT/VAT registration, and courier partnerships. All are tracked in `OPEN_QUESTIONS.md`.

## Repository layout (as it will exist by Phase 3)

```
nhonga-marketplace/
├── docs/                    # Design, architecture, and runbook documentation
├── packages/
│   ├── design-tokens/       # ✅ Exists now — shared source of truth for web + mobile
│   ├── shared/              # Types, validation schemas, money/locale utilities
│   └── ui-web/              # React component library built on the tokens
├── apps/
│   ├── web/                 # Next.js storefront + vendor + admin consoles
│   ├── mobile/              # React Native buyer app (iOS + Android)
│   └── api/                 # Backend modular monolith
└── infra/                   # Terraform, CI/CD
```

## Environment notes

| Tool                | Status                                       | Needed for                                 |
| ------------------- | -------------------------------------------- | ------------------------------------------ |
| **Node.js 24.19.0** | ✅ installed 2026-09-16 (winget, user scope) | API, web, mobile, all tooling              |
| **pnpm 9.12.0**     | ✅ via corepack                              | Monorepo workspace management              |
| **Git**             | ❌ not installed                             | Version control — nothing is committed yet |
| **Docker Desktop**  | ❌ not installed                             | Local Postgres, Redis, OpenSearch          |

⚠️ **Node is not on the default PATH.** winget installed it user-scope; prepend this in any shell
that reports `node` as unrecognised:

```powershell
$env:Path = "C:\Users\mozladmin\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:Path"
```

Use `pnpm install --ignore-scripts` until git exists — the root `prepare` script runs husky, which
fails outside a git repository.

**Two gaps still block progress:**

- **Git.** Nothing is under version control. Everything written so far exists only as files on
  disk, with no history and no way to review a change as a diff.
- **Docker.** Without a local Postgres, the checkout transaction, the payment event processor, and
  the reconciliation workers cannot be tested at all — and those are the components where the
  concurrency and idempotency claims actually need proving.

```powershell
winget install Git.Git Docker.DockerDesktop
```
