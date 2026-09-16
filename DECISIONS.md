# Decision Log

Append-only. Each entry records what was decided, the alternatives considered, why, and what it
would cost to reverse. Decisions made under assumption (pending your input) are marked
**[ASSUMED]** and cross-reference `OPEN_QUESTIONS.md`.

---

## Phase 1 — Design

### D-01 · Portuguese (pt-MZ) is the source locale, not a translation
**Decided:** All copy is authored in Portuguese first; English is the translation. Locale is
`pt-MZ`, not `pt-PT` or `pt-BR`.
**Why:** Products built English-first and translated ship awkward Portuguese — string
concatenation breaks, pluralisation is wrong, and layouts assume English's shorter words.
Portuguese averages 15–25% longer than English for equivalent UI copy, so every component is
specified with that headroom. pt-MZ matters: Mozambican Portuguese uses *bairro*, *celular*,
*talão*, and local currency conventions that pt-BR and pt-PT get wrong.
**Alternatives:** English-first with translation (cheaper to start, worse product, expensive to
retrofit).
**Reversal cost:** Low now, high after ~200 strings exist.

### D-02 · React Native for mobile ✅ **CONFIRMED 2026-09-15**
**Decided:** React Native (New Architecture, Hermes) for the iOS + Android buyer app.
**Why:** The decisive factor is the shared TypeScript layer — money arithmetic, cart pricing, the
payment state machine, and validation schemas must behave *identically* on web and mobile because
they touch money. React Native lets those be one tested package rather than two implementations
that drift. Hermes also gives materially better cold-start and memory behaviour on the low-end
Android devices this market runs, which is the main historical argument against RN.
**Alternatives considered:**
- *Flutter* — better rendering consistency and arguably better low-end performance, but the shared
  business logic would have to be rewritten in Dart, duplicating exactly the code where bugs cost
  money. Also a smaller Mozambican hiring pool.
- *Native iOS + Android* — best performance ceiling, roughly doubles cost and timeline. Nothing in
  this scope needs it.
**Reversal cost:** Very high after Phase 3 begins.

### D-03 · Buyer-facing native app is Android-first in effort, iOS in parity
**Decided:** Ship both, but prioritise Android in testing, device matrix, and performance budgets.
**Why:** Mozambican smartphone share is overwhelmingly Android, skewed to entry-level devices
(≤3GB RAM, low-end Snapdragon/MediaTek). iOS exists for a smaller, higher-value urban segment and
for credibility, not volume. Performance budgets are therefore set against a low-end Android
reference device, not an iPhone.
**Reversal cost:** N/A — a prioritisation, not an architecture.

### D-04 · Phone number is the primary identity; email is optional
**Decided:** `+258` MSISDN + SMS OTP is the account identifier. Email is an optional secondary
field, never required to transact.
**Why:** Email adoption is low relative to mobile penetration, and the payment rails are
themselves phone-number-based — the buyer's MSISDN *is* their M-Pesa/e-Mola wallet. Making phone
primary means identity and payment identity align naturally.
**Consequence:** OTP becomes a security-critical, cost-critical surface (every SMS costs money and
every OTP endpoint is an abuse target). Rate limiting, lockout, and per-number cost caps are
designed in from Phase 1, not bolted on. See `05-states-and-connectivity.md`.

### D-05 · Payment rail is auto-suggested from the MSISDN prefix
**Decided:** Checkout pre-selects the likely wallet from the buyer's phone prefix:
`84`/`85` → M-Pesa (Vodacom), `86`/`87` → e-Mola (Movitel), `82`/`83` → mKesh (Tmcel).
The buyer can always override — many people carry multiple SIMs or pay from another person's
wallet.
**Why:** Removes a decision from the highest-drop-off screen in the funnel, at zero cost when
wrong because it is a pre-selection rather than a constraint.
**Reversal cost:** Trivial — one mapping table.

### D-06 · Currency is formatted by a custom formatter, never by raw ICU output
**Decided:** A single `formatMZN()` in `packages/shared` produces `12.500,00 MT` — period
thousands separator, comma decimal, symbol `MT` trailing after a non-breaking space.
**Why:** `Intl.NumberFormat('pt-MZ', {currency:'MZN'})` output varies across ICU versions, Node
builds, Android WebViews, and Hermes — some emit `MTn`, some `MZN`, some lead rather than trail.
For a marketplace, inconsistent price rendering directly damages trust. One formatter, one snapshot
test, no ambiguity.
**Related:** money is stored and computed as integer centavos, never floating point.

### D-07 · Design system is brand-original, not an AliExpress clone
**Decided:** Deep green primary (`--color-primary`) with a warm amber commerce accent, rather than
the saturated orange-red of AliExpress/Shopee/Jumia.
**Why:** Two reasons beyond the explicit brief. First, the orange-red "bargain marketplace" palette
is saturated in this category — differentiating visually is cheap and compounds. Second, trust is
the binding constraint for a *new* marketplace asking people to send mobile money to strangers;
green reads as trustworthy and is locally resonant (Mozambican flag) without being nationalistic
kitsch. Amber is reserved strictly for commerce actions so "this button spends money" is learnable.
**Reversal cost:** Low — colour lives entirely in `packages/design-tokens`.

### D-08 · Borders over shadows for elevation
**Decided:** Component separation uses 1px borders and background steps; box-shadow is limited to
overlays (modals, bottom sheets, sticky bars).
**Why:** Large blurred shadows are a real GPU cost on entry-level Android, especially in long
scrolling product grids where dozens composite at once. Borders cost nothing and survive
low-contrast screens better in direct sunlight — a genuine condition for outdoor market traders.

### D-09 · Data-saving is a design constraint, not a feature toggle
**Decided:** Image budgets are fixed per surface (grid thumbnail ≤ 20KB, PDP hero ≤ 80KB, AVIF
with WebP fallback), all below-fold images lazy-load, and the catalogue list payload excludes
description bodies.
**Why:** On prepaid data at Mozambican rates, a heavy app is a *cost* to the user, not just a
slowness. A product grid that costs 4MB to scroll is a product grid people stop scrolling.
**Target:** first meaningful paint of the home feed under 2.5s on a throttled 3G connection, and
under 500KB total for the first screen.

### D-10 · Address model is hybrid structured + informal
**Decided:** Addresses carry structured fields (province → district → *bairro*) *and* free-text
landmark/reference fields, plus optional GPS coordinates captured at save time.
**Why:** Much of Mozambique outside central Maputo lacks reliable street addressing; deliveries
are routinely found by landmark ("casa azul perto da bomba da Petromoc"). A purely structured model
would force users to lie. A purely free-text model makes delivery zones, shipping rates, and
courier handoff impossible. The hybrid keeps both the machine-usable and human-usable parts.
**Consequence:** delivery fee calculation keys off district, never off the free-text portion.

### D-11 · Multi-vendor carts split into per-vendor sub-orders at checkout
**Decided:** One cart, one payment, N `sub_orders` — each with its own fulfilment lifecycle,
shipping fee, and settlement to its own vendor.
**Why:** A buyer thinks in one purchase; vendors ship, are paid, and are rated independently.
Modelling this as one flat order makes partial refunds, partial cancellations, and per-vendor
settlement enormously painful later. Modelling it correctly now costs one extra table.

### D-12 · Optimistic UI with a durable retry queue for network-fragile actions
**Decided:** Cart mutations, wishlist toggles, and review submissions apply locally and sync via a
persisted queue. Checkout and payment explicitly **do not** — they require confirmed server state.
**Why:** Intermittent connectivity should not make browsing feel broken, but optimistic UI on a
money-moving action creates the worst possible failure: a user who believes they paid and did not,
or who pays twice. The line is drawn exactly at the point where money moves.

### D-13 · Payment layer is provider-agnostic from the first line of code **[see OQ-7, OQ-8]**
**Decided:** A single `PaymentProvider` interface — `requestPayment`, `handleCallback`,
`queryStatus`, `refund` — with `MockMpesaProvider` / `MockEmolaProvider` implementations for
development, and COD as a degenerate provider implementing the same interface.
**Why:** Production credentials require merchant agreements I cannot obtain (OQ-7/OQ-8), so the
mock is not a shortcut — it is the only way to build and test the real checkout experience now.
Treating COD as a provider rather than a special case keeps the checkout state machine single-path.
**Where the production swap happens:** provider registration in
`apps/api/src/modules/payments/registry.ts`; no checkout, cart, or order code changes.

### D-14 · Order and payment lifecycles are explicit state machines
**Decided:** Both are modelled as enumerated states with declared legal transitions, enforced in
one place and covered by exhaustive unit tests.
**Why:** Mobile-money push payments are asynchronous and unreliable in ways cards are not — the
callback may arrive late, twice, out of order, or never, while the user's handset may show success.
Ad-hoc boolean flags (`is_paid`, `is_confirmed`) cannot survive that and produce exactly the bugs
that lose real money. The state machine plus idempotency keys on every callback is the defence.

### D-15 · Documentation is versioned with the code, in-repo
**Decided:** All design, architecture, and decision artifacts are Markdown in `docs/`.
**Why:** Design documentation that lives in a separate tool goes stale within a quarter. In-repo
docs move in the same pull request as the code they describe.

---

## Phase 2 — Architecture

### D-16 · AWS `af-south-1` (Cape Town) ✅ **CONFIRMED 2026-09-15**
**Decided:** All infrastructure in AWS Cape Town, expressed in Terraform.
**Why:** On 3G, round-trip latency dominates perceived speed far more than bandwidth. A European
region adds ~120ms to *every* request — invisible once, painful across a session, and specifically
painful in the checkout flow, which polls payment status repeatedly while the buyer watches a timer
and decides whether they have been robbed. The ~15–20% premium over `eu-west-1` is roughly $60–100
per month at launch scale.
**Alternatives:** GCP `africa-south1` (comparable latency, thinner in-region managed-service
catalogue); Hetzner/DigitalOcean Europe (60–90% cheaper, ~150–190ms RTT to Maputo).
**Reversal cost:** 1–2 weeks, bounded by Terraform.

### D-17 · Category-tiered commission + fixed per-order fee ✅ **CONFIRMED 2026-09-15**
**Decided:** Commission varies by category, plus a fixed fee per order. All values
admin-configurable. Stored in **basis points**, never a decimal percentage.
**Why:** Category margins differ enormously — electronics cannot carry a fashion rate. The fixed fee
protects platform economics on low-value orders, which matter because mobile-money costs are
themselves close to fixed. Basis points mean no floating-point rounding can ever enter a fee
calculation.
**Consequence:** `commission_rule` is never updated in place — a change closes the old row with
`effective_to` and inserts a new one, and the applied rule ID is stored on each settlement. A vendor
asking in 2028 why they were charged 12% on a 2026 order gets an exact answer.

### D-18 · Modular monolith, not microservices
**Decided:** One NestJS deployable with enforced internal module boundaries. One exception: the
payment callback receiver deploys separately.
**Why:** Placing an order must atomically touch inventory, orders, payments, and settlement. In a
monolith that is one Postgres transaction; split across services it becomes a saga, whose failure
mode is *money in the wrong place*. Microservices pay off when independent teams need independent
deploy cadences — there are no independent teams here, so the cost is paid immediately and the
benefit arrives at a scale this project will not reach for years. Latency also compounds: every
inter-service hop is real time added to a request from an already-slow client.
**The webhook exception is an availability requirement, not a preference:** provider callbacks must
keep being accepted while the main application is deploying or degraded, because a callback we fail
to accept may be a payment we never learn about.
**Mitigation:** boundaries enforced in CI by dependency-cruiser, so extraction stays cheap if ever
warranted.

### D-19 · REST + OpenAPI, not GraphQL
**Decided:** REST, OpenAPI 3.1, cursor pagination.
**Why:** GraphQL's field selection is genuinely attractive on a bandwidth-constrained market, but it
forfeits HTTP caching — and CloudFront + service worker + mobile HTTP cache keyed by URL is the
single largest data-saving lever available to us (D-09). Cacheability beats field selection here.
REST is also far simpler to reason about against the offline retry queue (D-12).
**Mitigation for over-fetching:** purpose-built response shapes (`ProductListItem` vs
`ProductDetail`) rather than pushing the problem to the client.

### D-20 · Next.js with server-side rendering
**Decided:** Next.js 15 App Router, containerised on ECS (not Vercel).
**Why:** SSR is a requirement, not an optimisation. Primary discovery in this market is a link
shared on WhatsApp, which needs server-rendered Open Graph tags or the share shows nothing. Organic
search matters for a young marketplace. And on 3G, server-rendered HTML shows a product while the
JS is still downloading. Self-hosting keeps rendering in the same region as the database and inside
one Terraform definition.

### D-21 · PostgreSQL as the single source of truth
**Decided:** Postgres 16, with Redis and OpenSearch as derived stores only.
**Why:** Orders, payments, inventory, and settlements need real ACID guarantees and real foreign
keys. Every serious marketplace failure story is an eventual-consistency story about inventory or
money. JSONB covers per-category product attributes without reaching for a document store.
**Money is `BIGINT` centavos everywhere.** Business invariants are `CHECK` constraints — a negative
`stock_quantity` is a transaction that cannot commit, not a race the application is trusted to
avoid.
**OpenSearch is a read model**, rebuildable from Postgres. If it is down, search degrades to
Postgres category listings rather than failing.

### D-22 · One `PaymentProvider` interface; COD is a provider
**Decided:** `requestPayment` / `parseCallback` / `queryStatus` / `refund` / `disburse?`, with mock
implementations for development and COD implementing the same interface.
**Why:** Production credentials require merchant agreements I cannot obtain (OQ-7, OQ-8), so the
mock is not a shortcut — it is the only way to build and test real checkout today. Treating COD as a
provider rather than a special case keeps the checkout state machine single-path; a forked state
machine is where money gets lost.
**Where the production swap happens:** `apps/api/src/modules/payments/registry.ts`, plus credentials
in Secrets Manager and `PAYMENTS_MODE=live`. Nothing in checkout, orders, or either client changes.
If they need to change when real credentials arrive, the abstraction was wrong.

### D-24 · Money is a branded `number` of centavos in TypeScript, `BIGINT` in Postgres
**Decided:** `type Cents = number & { brand }`, not `bigint`.
**Why:** the Phase 2 payments interface specified `bigint`, and writing the code showed that to be
wrong. JSON cannot carry `bigint`, and every amount crosses a JSON boundary between the API, the
web app, and the mobile app — so `bigint` would mean a serialise/deserialise shim at every edge,
which is exactly the kind of per-boundary conversion that eventually gets one boundary wrong.
`Number.MAX_SAFE_INTEGER` is about 90 trillion meticais in centavos, so the headroom is not a
practical concern. The brand keeps a raw `number` from being passed where an amount is expected.
**Consequence:** `centsFromDb()` is the single guarded parse of the string a `BIGINT` column
returns, and `cents()` validates integrality and range at every construction site.

### D-25 · COD advances a sub-order on `payment_deferred`, never on `payment_settled`
**Decided:** a distinct sub-order event for cash on delivery.
**Why:** writing the COD provider surfaced a modelling gap. COD orders must proceed to fulfilment
before any money exists, but reusing `payment_settled` would put a row in the audit trail claiming
funds arrived when they had not — and would make settlement eligible against money the platform
does not hold. One extra event keeps the audit trail honest and the settlement engine correct.
**Related:** OQ-18 — COD inverts the settlement direction, since the vendor or courier collects
the cash and therefore *owes* the platform its commission.

### D-26 · `PAYMENTS_MODE=live` fails at startup until the real adapters exist
**Decided:** the registry throws rather than falling back to mocks when live mode is configured.
**Why:** a production deploy that quietly ran mock payments would accept orders and never charge
anyone. That failure is silent, total, and discovered by an accountant. Failing at startup makes
it impossible to ship.
**Correction to Phase 2 docs:** the swap is *not* "one factory function plus credentials" — the
M-Pesa and e-Mola adapter classes still have to be written, and they cannot be written correctly
until the integration specifications arrive with the signed merchant agreements. I deliberately
did not write speculative adapters against a guessed API shape; a plausible-looking wrong
implementation is more dangerous than an explicit gap.

### D-23 · Reconciliation never depends on webhooks
**Decided:** Scheduled workers query provider status independently of callback delivery, including a
72-hour late sweep that can move `EXPIRED → PAID`.
**Why:** Mobile-money callbacks arrive late, duplicated, out of order, or never. The scenario the
late sweep exists for is a buyer who approves on their handset after our 3-minute window closed: the
money leaves their wallet and our UI said "expired". Without that job, that is a debited customer
with no order — the worst outcome the system can produce, and the one that generates the story that
spreads.
