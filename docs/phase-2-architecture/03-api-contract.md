# 03 · API Contract

Phase 2 · Architecture | Status: awaiting sign-off
Machine-readable contract: [`apps/api/openapi.yaml`](../../apps/api/openapi.yaml)

> **Note:** the YAML has not been machine-validated — this workstation has no Node, Python, or git
> installed (see [README](../../README.md#environment-notes)). `npx @redocly/cli lint` runs as the
> first CI job in Phase 3.

---

## 1. What the spec covers

The buyer-critical core: identity, catalogue, cart, checkout, payments, orders, addresses, reviews.
These are the surfaces that define the architecture and carry the money.

The vendor and admin consoles follow identical conventions and are specified separately in Phase 3
(`openapi-vendor.yaml`, `openapi-admin.yaml`) — splitting them keeps the public contract reviewable
and lets us publish it to third parties later without exposing internal operations.

## 2. Conventions

### Money

Always an integer in **centavos**, in a field suffixed `Cents`. Never a float. Never a preformatted
string. Formatting happens client-side through `formatMZN()` in `packages/shared` (D-06), so the
server has exactly one representation and the clients have exactly one formatter.

### Idempotency

`Idempotency-Key` is **mandatory** on every request that creates or moves money. The server stores
the full response against the key for 24 hours and replays it verbatim on a repeat.

This is what makes the pay button safe to double-tap on a bad connection, and what makes the mobile
retry queue (D-12) safe to replay after a crash. A checkout replayed with the same key returns the
original order — it does not create a second one.

### Pagination

Cursor-based everywhere. Offset pagination is not offered: the catalogue changes under the reader,
and offsets silently skip or duplicate rows — which on an infinite-scroll product grid means a buyer
never sees a product that existed the whole time.

### Errors

RFC 9457 `application/problem+json`. Two rules that follow from the design work in
[05 · States](../phase-1-design/05-states-and-connectivity.md):

- `detail` is **already localised** per `Accept-Language` and is safe to render directly. Clients
  never build error copy from codes.
- `traceId` is for support and belongs _beneath_ the message, never as the message.

### Caching

Public catalogue reads carry `Cache-Control` with `stale-while-revalidate` and an `ETag`. Cart,
checkout, payment status, orders, and everything under vendor or admin scope are `no-store` —
serving a stale payment status is exactly the failure that loses money.

### Versioning

URL-prefixed (`/v1`). Additive changes ship without a version bump; anything breaking gets `/v2`
with the previous version supported for at least six months. Mobile clients cannot be force-updated
on entry-level Android in this market — old app versions stay in the field far longer than you
expect, and the contract has to tolerate that.

## 3. Endpoints that deserve specific attention

### `POST /checkout` — 202, not 201

The response means _the order exists and payment has been requested_, not _paid_. Mobile-money push
resolves in 10–120 seconds, asynchronously. Returning 201 would imply a completed resource and
invite clients to treat the order as paid.

It also takes `expectedTotalCents`. If the server's computed total no longer matches what the buyer
was shown, the request is rejected with 409 rather than charging a different amount than the one on
the screen. Price drift between the review step and the tap is rare but not hypothetical, and
silently charging more is unacceptable.

### `GET /payments/{id}` — the client's safety net

Recommended backoff: 2s, 4s, 8s, then every 10s to a 3-minute ceiling. The client renders what this
returns and never concludes payment state on its own (user flows §2, rule 3).

### `POST /payments/{id}/retry` — new attempt, new key

Creates a genuinely new attempt with a fresh idempotency key, so a retry cannot be collapsed into
the prior one while a _duplicate of the same attempt_ still is. It may switch provider, so a failed
M-Pesa attempt can become an e-Mola or COD attempt rather than dropping out of the funnel.

It refuses with 409 if the original payment later reached `paid` — which genuinely happens when
someone approves on the handset after our expiry window closed.

### `GET /catalog/products` — `degraded: true`

When OpenSearch is unavailable, results come from the Postgres fallback and the flag is set. Clients
show a "search is limited" notice. Browsing degrades; it does not fail (architecture §9).

### `POST /reviews` — requires a delivered `orderItemId`

Not a `productId`. Only a verified delivered purchase can produce a review. This is the primary
defence against review fraud, and it is enforced by the shape of the request, not by a check that
could be forgotten.

## 4. Rate limits

| Endpoint group           | Limit                                    | Window        | Keyed on  |
| ------------------------ | ---------------------------------------- | ------------- | --------- |
| `POST /auth/otp/request` | 3                                        | 15 min        | phone     |
| `POST /auth/otp/request` | 10                                       | 1 hour        | IP        |
| `POST /auth/otp/request` | global circuit breaker + daily spend cap | —             | platform  |
| `POST /auth/otp/verify`  | 5 attempts                               | per challenge | challenge |
| `POST /checkout`         | 5                                        | 10 min        | user      |
| `POST /payments/*/retry` | 5                                        | 10 min        | order     |
| Catalogue reads          | 300                                      | 1 min         | IP        |
| Authenticated reads      | 600                                      | 1 min         | user      |

Limits are enforced in Redis at the API edge and again at the WAF. **When Redis is unavailable,
auth rate limiting fails closed** — login is refused rather than left unprotected (architecture §9).

## 5. Client generation

`openapi.yaml` is the source. `openapi-typescript` generates request/response types into
`packages/shared`, consumed by both web and mobile. CI fails if the committed generated types drift
from the spec, so the contract cannot silently diverge from the clients.

---

**Next:** [04 · Payments Architecture](04-payments-architecture.md)
