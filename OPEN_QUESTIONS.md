# Open Questions

Anything blocked on your input or on an external party. Each item says who owns it, what it
blocks, and what I've assumed in the meantime so work can continue.

Status key: 🔴 blocking next phase · 🟡 needed before launch · 🟢 nice to resolve early

---

## ✅ Resolved 2026-09-15

| # | Question | Decision |
|---|---|---|
| **OQ-2** | Cloud provider and region | **AWS `af-south-1` (Cape Town)** — see D-16 |
| **OQ-3** | Mobile framework | **React Native** — D-02 confirmed |
| **OQ-4** | Commission model | **Category-tiered % + fixed per-order fee**, admin-configurable — see D-17 |
| **Phase 1** | Design sign-off | **Approved**, Phase 2 started |

---

## Blocked on you (decisions)

### OQ-1 🟢 — Product name
**Name chosen by the founder on 2026-09-16: "Nhonga"**, replacing the earlier working codename
"Banca". Applied across the codebase, docs, package scope (`@nhonga/*`), design tokens, the
deep-link scheme (`nhonga://`), container names, the database name, and the placeholder domains.
The name is still stored as a token + i18n string and is never hardcoded, so a further change
stays cheap until Phase 5.

**No meaning is asserted for "Nhonga" anywhere in the documentation.** The previous codename was
documented as Portuguese for a market stall; that gloss belonged to "Banca" and has been removed
rather than transferred. If "Nhonga" carries a meaning you want stated publicly, tell me and I
will add it.

**Still open, and more urgent now the name is committed to code:**

| Check | Why it matters | Status |
|---|---|---|
| Trademark search for "Nhonga" in Mozambique, and in any market you plan to enter | A registered conflict forces a rebrand after launch, which is far more expensive than now | Not started |
| Business-register / company-name search | Another entity may already trade under it | Not started |
| Domain registration: `nhonga.co.mz` | Already referenced in `openapi.yaml` server URLs and webhook callback URLs as a placeholder — **not checked, not registered** | Not started |
| App-store name availability (Apple, Google) | See OQ-14; store names are first-come | Not started |

**Blocks:** nothing technically. Cost of change rises sharply after Phase 5 store submission.

### OQ-2 ✅ — Cloud provider and hosting region — **RESOLVED: AWS `af-south-1`**
This materially changes cost, latency, and data-residency exposure.

| Option | Nearest region | Rough monthly at launch scale | Notes |
|---|---|---|---|
| AWS | `af-south-1` (Cape Town) | ~$350–600 | Best Southern Africa latency; af-south-1 costs ~15–20% above eu-west-1 |
| GCP | `africa-south1` (Johannesburg) | ~$300–550 | Comparable latency; smaller managed-service catalogue in-region |
| Hetzner / DigitalOcean | Frankfurt / Amsterdam | ~$80–200 | 60–90% cheaper, but ~150–190ms RTT to Maputo vs ~25–40ms from Johannesburg |

**My recommendation:** AWS `af-south-1`. On 3G, round-trip latency dominates perceived speed far
more than raw bandwidth, and a European region adds ~120ms to *every* request — which compounds
badly on a checkout flow that polls payment status.
**Assumed meanwhile:** AWS `af-south-1`, with all infrastructure expressed in Terraform so the
provider is replaceable at real but bounded cost (~1–2 weeks).
**Blocks:** Phase 2 infrastructure design.

### OQ-3 ✅ — Native apps vs. cross-platform — **RESOLVED: React Native**
I recommend **React Native** (see DECISIONS.md D-02). Building true native iOS + Android instead
roughly doubles mobile engineering cost and timeline for this scope. Tell me if you have a reason
to want native that I'm not seeing — e.g. a specific SDK requirement from a payment or logistics
partner.
**Assumed meanwhile:** React Native.
**Blocks:** Phase 2 stack finalisation.

### OQ-4 ✅ — Commission model — **RESOLVED: category-tiered % + fixed fee**
This drives the settlement engine, vendor payout maths, the fee-configuration admin surface, and
your unit economics. Options I can build for:
- **Flat percentage** per order (simplest; e.g. 8%)
- **Category-tiered** percentage (electronics 5%, fashion 12% — reflects margin differences)
- **Percentage + fixed fee** per transaction (protects you on low-value orders, which matter a lot
  when mobile-money fees are themselves fixed-ish)
- **Subscription + lower percentage** (harder to sell to first vendors)

**My recommendation:** category-tiered percentage plus a fixed per-order fee, configurable in
admin from day one. Building the tiered model up front costs little; retrofitting it later means
migrating live fee history.
**Assumed meanwhile:** category-tiered + fixed fee, all values admin-configurable, seeded at a
flat 8% + 10 MT until you decide.
**Blocks:** Phase 2 data model for `commission_rule` and `settlement`.

### OQ-5 🟡 — Who bears the mobile-money transaction fee?
M-Pesa and e-Mola charge per transaction. Buyer-pays (shown as a line item), vendor-pays (deducted
at settlement), or platform-absorbs are all defensible, and it changes the checkout UI.
**Assumed meanwhile:** platform-absorbs, displayed nowhere — but the order model carries a
`payment_fee` field from day one so the policy can change without a migration.

### OQ-6 🟡 — Launch geography
National from day one, or Maputo + Matola first? This changes the delivery model, vendor
onboarding effort, and how aggressively the address system must handle informal addressing.
**Assumed meanwhile:** Maputo/Matola launch, with the data model national from day one.

---

## Blocked on third parties (you must initiate; I cannot)

### OQ-7 🔴 — Vodacom M-Pesa merchant agreement
**What's needed:** business registration (Alvará + NUIT), a Vodacom business relationship,
KYB submission, signed merchant agreement, issued *Short Code* / merchant number, then API
credentials (`api_key`, `public_key`, `service_provider_code`) for sandbox and production.
**Typical lead time:** 4–12 weeks. Start this now — it is the longest pole in the project.
**Where the swap happens in code:** `apps/api/src/modules/payments/providers/mpesa/` — replace
`MockMpesaProvider` with `MpesaProvider` behind the same `PaymentProvider` interface, and set
credentials in the secret manager. No checkout code changes.
**Assumed meanwhile:** mock provider reproducing C2B push → user approves on handset → async
webhook confirmation → status polling fallback.

### OQ-8 🔴 — Movitel e-Mola merchant agreement
Same shape as OQ-7, via Movitel's business channel. Public documentation is thinner than M-Pesa's;
expect the integration spec to arrive as a PDF after signature. I've designed the provider
interface to absorb reasonable variation in their callback contract.
**Assumed meanwhile:** mock provider with the same push/callback semantics as M-Pesa.

### OQ-9 🟡 — Settlement bank account
You need a Mozambican business bank account for vendor payouts and platform revenue. Mobile-money
merchant accounts settle to a bank account; without one, money has nowhere to land.

### OQ-10 🟡 — Tax registration (NUIT) and VAT/IVA
Mozambique's IVA rate and marketplace-facilitator obligations — specifically, whether *you* or
each *vendor* is the party liable to remit IVA on a marketplace sale — determine whether tax is
computed per-vendor or platform-wide, and that is a data-model decision.
**This needs a Mozambican tax advisor, not me.** I will build a configurable tax engine that can
express either model, and will not guess at the correct treatment.

### OQ-11 🟡 — Courier partnerships
There is no uniform national courier/addressing system. Who actually moves the parcels? Options
include vendor self-delivery, local motoboy networks, Correios de Moçambique, or private couriers.
**Assumed meanwhile:** the model supports both marketplace-arranged and vendor-arranged delivery
with pickup points, and ships with a "vendor-arranged" default so launch does not block on a
courier contract.

### OQ-12 🟡 — SMS gateway for OTP and notifications
OTP authentication and SMS fallback both need a gateway with reliable Mozambican delivery.
Options: direct operator agreements (best deliverability, slowest to obtain), or an aggregator
(Africa's Talking, Infobip, Twilio — faster but pricier per message).
**Assumed meanwhile:** aggregator behind an `SmsProvider` interface mirroring the payment
abstraction, with a mock provider for development.

### OQ-13 🟡 — Data protection review
Mozambique does not yet have a single comprehensive data protection statute equivalent to GDPR,
but constitutional privacy protections, sectoral rules, and e-transaction legislation apply, and
the landscape is moving. If you ever serve EU residents, GDPR attaches regardless.
**This needs local legal counsel.** I will build to GDPR-grade practices as the safe baseline
(explicit consent, data minimisation, export and deletion paths, audit logging) and flag rather
than guess at anything jurisdiction-specific.

### OQ-15 🔴 — **Does operating as merchant of record require a payments licence?**
*Raised in Phase 2. This is now the highest-consequence open question in the project.*

We collect buyer payments into a platform account and settle to vendors (assumption A-7). In many
jurisdictions that is regulated payment aggregation. Whether Banco de Moçambique requires a licence
for this model — or whether it can operate under the M-Pesa/e-Mola merchant agreements alone —
determines whether the business model as designed is legal.

**This needs a Mozambican financial-services lawyer, and it should go to them before Phase 3
completes.** An answer of "yes, you need a licence" changes the business model, not the code. The
alternative model — vendors as merchant of record with the platform never touching funds — is
architecturally very different and much more expensive to retrofit than to choose.

### OQ-16 🟡 — Does e-Mola support programmatic disbursement?
Settlement to Movitel vendors assumes we can pay out to an e-Mola wallet via API. M-Pesa's B2C
capability is documented; e-Mola's is not publicly. **Raise this in your first conversation with
Movitel** — if the answer is no, payouts to Movitel vendors need a manual or bank-transfer path,
which materially changes settlement operations.

### OQ-17 🟡 — Settlement cadence
Daily, weekly, or on-demand payouts to vendors? Affects working-capital requirements and vendor
attractiveness. **Recommend weekly at launch**, with manual early release for vendors in good
standing.
**Assumed meanwhile:** weekly, admin-configurable.

### OQ-18 🟡 — Cash on delivery inverts the settlement direction
*Raised in Phase 3 while writing the COD provider.*

With M-Pesa or e-Mola, the platform holds the money and pays the vendor their share. **With COD,
the vendor or courier collects the cash — so the vendor owes the platform its commission, not the
other way round.** The settlement engine as designed only pays outward.

Options, in rough order of operational simplicity:
- **Net it off against the vendor's wallet-based settlements.** Works only for vendors with enough
  prepaid volume to cover their COD commission, which excludes exactly the phone-only sellers COD
  matters most to.
- **Invoice the vendor periodically.** Straightforward, introduces receivables and chasing.
- **Require a prepaid balance before a vendor may offer COD.** Cleanest financially, a real
  barrier to the small sellers we most want.
- **Don't offer COD at launch.** I'd advise against it — for many first-time buyers COD is the only
  acceptable way to make a first purchase, and the first purchase is the one that converts a
  sceptic.

**Assumed meanwhile:** COD is modelled end to end and the sub-order advances on `payment_deferred`
rather than `payment_settled`, so nothing claims money arrived. Settlement for COD sub-orders is
computed but marked `held` pending your decision.

### OQ-14 🟡 — Apple and Google developer accounts
Apple Developer Program ($99/yr) and Google Play Console ($25 one-time), both requiring a legal
entity and D-U-N-S for the Apple organisation account. Lead time for Apple org verification can
reach several weeks.
