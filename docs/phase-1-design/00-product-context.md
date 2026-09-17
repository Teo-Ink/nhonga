# 00 · Product Context

Phase 1 · Design | Status: awaiting sign-off

---

## 1. What we are building

A multi-vendor marketplace where Mozambican sellers — from established retailers to individual
market traders — list products, and Mozambican buyers discover, purchase, and pay for them using
the mobile money they already use daily.

The AliExpress comparison is about **structure**, not imitation: a broad multi-category catalogue,
independent vendor storefronts, a cart that spans vendors, an order lifecycle the buyer can watch,
and reviews that make strangers safe to buy from. We copy that skeleton. We do not copy its visual
language, its density, or its assumption of cheap reliable bandwidth.

## 2. The three constraints that shape every decision

Most e-commerce design advice assumes cheap data, reliable connectivity, card payments, and
addresses that exist. None of those hold here. Three constraints do the real design work:

### 2.1 Data costs the user money

Prepaid mobile data is the norm and it is not cheap relative to income. A heavy app does not merely
feel slow — it charges the user for the privilege. This inverts several standard patterns:

- Autoplaying video, carousel hero images, and high-resolution galleries are **costs**, not delight.
- Infinite scroll that prefetches aggressively is hostile. We prefetch one screen ahead, not five.
- The catalogue is cached and served stale-while-revalidate, so re-browsing costs nothing.
- Every image has a byte budget enforced in CI, not a guideline. See D-09.

### 2.2 Connectivity is intermittent, not merely slow

The failure mode is not "slow request" — it is "request that never completes, on a train, in a
building, in a power cut." The design response:

- **Browsing must work degraded.** Cached catalogue, cached recently-viewed products, cached cart.
- **Non-financial actions queue and retry.** Add to cart, wishlist, review drafts.
- **Financial actions never optimistically succeed.** A payment must reach confirmed server state
  or be clearly marked pending. See D-12.
- **Pending is a first-class state**, not an error. Mobile money genuinely takes 10–120 seconds,
  and the user must be able to leave the screen, lose signal, return, and find the truth.

### 2.3 Trust has not been established

This is the constraint most easily underestimated. A new marketplace is asking someone to send
money from their M-Pesa wallet to a stranger they found in an app, for goods that arrive later, in
a market where that has gone badly for people. Nothing about the product works if this fails.

Design consequences, which show up throughout the flows:

- Vendor identity is prominent everywhere — never an anonymous "sold by a third party" footnote.
- Verification badges are earned and explained, not decorative.
- The order timeline over-communicates. Silence reads as theft.
- Cash on Delivery is offered as a genuine first-class option, not a grudging fallback — for many
  first-time buyers it is the only acceptable way to make a first purchase, and the first purchase
  is the one that matters.
- Dispute initiation is visible _before_ purchase, not buried after it. Knowing recourse exists is
  what makes the purchase possible.

## 3. Personas

These are design tools, not market research. They exist to settle arguments about screen layout.

### Buyer — Ângela, 27, Maputo

Administrative assistant. Android phone with 3GB RAM, prepaid data she budgets carefully. Uses
M-Pesa several times a week, WhatsApp constantly. Has bought online once, from a Facebook seller,
and it went fine but felt risky. Shops on the _chapa_ home from work — one hand, standing, bad
signal in tunnels.
**Design implications:** thumb-reachable primary actions, works at 3G and while briefly offline,
minimal text entry, prices legible at a glance, vendor trust signals visible before she taps.

### Buyer — Salvador, 41, Nampula

Owns a small hardware shop; buys stock for resale. Older Android, often on 3G. Wary of paying in
advance to anyone he does not know. Buys in quantity, compares prices carefully, and will phone a
seller before ordering.
**Design implications:** COD matters enormously to him; quantity-aware pricing; vendor contact and
location visible; order history that supports repeat ordering.

### Vendor — Nélia, 33, Beira

Sells clothing; currently trades via WhatsApp status and Facebook. Manages inventory in her head
and a notebook. Phone-only — she has no laptop and will never have one.
**Design implications:** **the vendor console must be fully usable on a phone.** This is the single
most commonly broken assumption in marketplace software and it would exclude most of our supply
side. Bulk upload must tolerate photos taken on a phone in bad light. Order notifications must
reach her without her opening an app.

### Vendor — Loja Cristal, Maputo

Established electronics retailer, 400 SKUs, has a desktop and staff. Needs bulk CSV upload, variant
management, and payout reconciliation that their bookkeeper can check.
**Design implications:** desktop vendor console with real data density; CSV import/export; exports
that reconcile against bank statements.

### Admin — platform operations

Approves vendors, moderates listings, resolves disputes, monitors fraud. Desktop. Needs queues,
audit trails, and the ability to explain to a vendor exactly why something happened.

## 4. Scope boundaries for v1

**In scope:** everything in the brief's §3 functional scope.

**Explicitly deferred**, to be revisited after launch — recorded here so they are decisions rather
than omissions:

| Deferred                                   | Why                                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local-language UI (Changana, Macua, Sena…) | i18n infrastructure is built for it from day one (D-01), but translation requires native speakers and a content budget. Adding a locale later is a string-bundle drop, not a refactor. |
| Vendor-to-buyer live chat                  | Ticketing and order-scoped messaging ship in v1; real-time chat is significant infrastructure with a moderation burden. Order-scoped async messaging covers most of the need.          |
| Cross-border / import listings             | Requires customs, duty calculation, and a very different delivery model.                                                                                                               |
| Promotions engine (coupons, flash sales)   | Genuinely valuable for a marketplace, genuinely complex. The pricing engine is designed with a discount-hook seam so it can be added without touching cart maths.                      |
| Buyer credit / BNPL                        | Regulated financial activity. Not without counsel.                                                                                                                                     |

## 5. Assumption register

Every assumption made in Phase 1 that you should either confirm or correct. Assumptions with
material cost consequences are escalated to `OPEN_QUESTIONS.md`.

| #    | Assumption                                                                                     | If wrong, cost to change                  |
| ---- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| A-1  | Launch is Maputo/Matola first, national model from day one                                     | Low — configuration                       |
| A-2  | Vendors are Mozambique-based and locally registered                                            | Medium — KYC flow changes                 |
| A-3  | Catalogue is physical goods only; no digital goods or services                                 | Medium — fulfilment model                 |
| A-4  | Buyers may transact without registering a bank card, ever                                      | None — this is a design goal              |
| A-5  | Vendor console must work on a phone (see Nélia)                                                | High if discovered late                   |
| A-6  | SMS delivery to all three operators is reliably achievable via an aggregator                   | High — see OQ-12                          |
| A-7  | Platform is the merchant of record for payment collection; vendors are settled by the platform | High — legal and tax structure, see OQ-10 |
| A-8  | v1 supports one currency (MZN) only                                                            | Medium                                    |
| A-9  | Product images are vendor-supplied; no platform photography service                            | Low                                       |
| A-10 | Order volumes at launch are ≤ ~1,000 orders/day, informing infrastructure sizing               | Low — designed to scale past it           |

---

**Next:** [01 · Information Architecture](01-information-architecture.md)
