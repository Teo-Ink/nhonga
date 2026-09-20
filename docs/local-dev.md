# Local development & test environment

The catalogue slice runs end to end on a laptop with no Docker and no cloud:
**Postgres → API → Next.js storefront**. This is the pre-flight before deploying
to AWS or Railway — the same code, a different host.

## Prerequisites

- Node 24 + pnpm (via corepack)
- PostgreSQL 17 running locally on `:5432`

## One-time database setup

```bash
# Create the role and database the app expects
psql -U postgres -c "CREATE ROLE nhonga LOGIN PASSWORD 'nhonga' CREATEDB;"
psql -U postgres -c "CREATE DATABASE nhonga OWNER nhonga;"

export DATABASE_URL="postgresql://nhonga:nhonga@127.0.0.1:5432/nhonga"

pnpm --filter @nhonga/shared build
pnpm --filter @nhonga/api build
pnpm --filter @nhonga/api db:migrate   # 28 tables, 81 CHECK constraints
pnpm --filter @nhonga/api db:seed      # 6 products, 11 variants, 7 images
```

## Run the stack

Two terminals (the web reads the API server-side):

```bash
# Terminal 1 — API on :3000
export DATABASE_URL="postgresql://nhonga:nhonga@127.0.0.1:5432/nhonga"
PAYMENTS_MODE=mock MOCK_CALLBACK_SECRET=dev-only-not-a-real-secret \
  pnpm --filter @nhonga/api start   # or: node apps/api/dist/main.js

# Terminal 2 — storefront on :3001
API_URL="http://127.0.0.1:3000" pnpm --filter @nhonga/web dev
```

Open <http://localhost:3001>.

## What works, and what does not

**Works, against real Postgres data:**

- `GET /health/live`, `GET /health/ready` (pings the DB)
- `GET /catalog/products` and `GET /catalog/products/:idOrSlug`
- The storefront: product grid and product detail, Portuguese-first, mobile-first,
  MZN prices, discounts, ratings, verified vendors, and variant availability
  (a sold-out option is shown struck through, never hidden).

**Deliberately not wired** — these need services that are not built (auth, KMS
field cipher, shipping quotes, the job queue), so they are absent rather than
faked:

- cart, checkout, orders
- the "Adicionar ao carrinho" button (disabled, labelled _em breve_)

**Payments** run in `mock` mode. `GET /payments/:id` and the webhook receiver
work; no real M-Pesa/e-Mola until the merchant agreements land (OQ-7/OQ-8).
