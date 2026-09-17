# 05 · States & Connectivity

Phase 1 · Design | Status: awaiting sign-off

In most markets these are edge cases. Here they are the normal operating condition, so they are
specified as fully as the happy path.

---

## 1. The connectivity model

Four states, each with a designed treatment. The app determines its state from actual request
outcomes, not only from the OS connectivity flag — Android happily reports "connected" on a captive
portal or a dead 3G cell.

| State       | Detection                                              | Treatment                                                                                     |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Online**  | Requests succeeding, RTT < 1s                          | Normal                                                                                        |
| **Slow**    | RTT > 1s or two consecutive timeouts                   | Skeletons persist longer, prefetch disabled, image quality steps down, "a carregar…" after 3s |
| **Offline** | Requests failing, no network                           | Offline banner, cached content browsable, mutations queue, checkout blocked with explanation  |
| **Stale**   | Cached content older than its TTL, no refresh possible | Content shown with a "guardado" marker and its age                                            |

**Stale is shown, not hidden.** A product page with a three-day-old price marked as saved is far
more useful than a spinner — and marking it protects us when the price has since changed.

## 2. Loading states

**Skeletons, not spinners,** for anything with a predictable shape. A skeleton that matches the real
layout eliminates layout shift on arrival, which matters more on a slow connection where the gap
between skeleton and content is seconds rather than milliseconds.

| Surface         | Treatment                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Home feed       | Category chips + 4 product-card skeletons; cached "Continuar a ver" renders immediately with real data |
| Product grid    | 6 card skeletons, then progressive fill                                                                |
| PDP             | LQIP hero + skeleton text blocks; price and title arrive first (SSR)                                   |
| Cart            | Full skeleton; cached cart renders instantly, then reconciles                                          |
| Order timeline  | Skeleton rows at known heights                                                                         |
| Buttons         | Inline spinner **inside the button**, width preserved, disabled                                        |
| Payment pending | Its own designed screen (key screens §7), not a loading state                                          |

Skeleton shimmer uses a background-position animation (compositor-only) rather than animating a
gradient — a shimmer that costs frames on an entry-level device is worse than no shimmer, so it is
also disabled under `prefers-reduced-motion`.

Three rules:

1. No spinner before 300ms — most cached responses beat it, and a flash of spinner reads as jank.
2. Nothing loads for more than 10s without becoming an error with a retry.
3. Never block the whole screen for a partial update. Failure is scoped to the section that failed.

## 3. Empty states

Every empty state answers: what happened, why, what now.

| Surface             | Copy (PT)                                 | Primary action                                        |
| ------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Search, no results  | "Ainda não há resultados para «{query}»"  | Remove filters (if any), else broaden search          |
| Category, empty     | "Esta categoria ainda está a crescer"     | Browse related categories + "Avisar-me"               |
| Cart                | "O seu carrinho está vazio"               | "Ver produtos populares"                              |
| Wishlist            | "Guarde aqui o que gostar"                | Explain the ♡ action                                  |
| Orders              | "Ainda não fez nenhuma compra"            | "Começar a comprar"                                   |
| Vendor, no products | "Adicione o seu primeiro produto"         | "+ Adicionar produto" — the whole point of the screen |
| Vendor, no orders   | "Ainda sem pedidos. Partilhe a sua loja." | "Partilhar no WhatsApp" — the actual growth channel   |
| Admin queue, empty  | "Fila vazia. Nada para aprovar."          | — (a genuinely good outcome)                          |
| Reviews, none       | "Ainda sem avaliações. Seja o primeiro."  | —                                                     |

Empty-state copy never implies the user did something wrong. On a young marketplace an empty result
usually means our catalogue is thin, and blaming the user for our gap costs us the user.

## 4. Error states

### Taxonomy

| Class          | Example                  | Treatment                                      | Retry                   |
| -------------- | ------------------------ | ---------------------------------------------- | ----------------------- |
| **Network**    | Request timed out        | Inline, scoped to the section                  | Yes, automatic + manual |
| **Server 5xx** | API unavailable          | Full-screen with reference code                | Manual                  |
| **Validation** | Invalid phone number     | Inline, at the field, on blur                  | N/A                     |
| **Auth**       | Session expired          | Re-auth sheet, context preserved               | Resume after            |
| **Business**   | Out of stock at checkout | Blocking, explained, with a path forward       | N/A                     |
| **Payment**    | Payment declined         | Dedicated screen, alternatives offered         | Yes, new attempt        |
| **Permission** | Camera denied            | Explain why it's needed, deep-link to settings | N/A                     |

### Rules

- **Plain Portuguese, never codes.** "Não foi possível ligar. Verifique a sua internet." A
  reference code may appear _beneath_ the message for support, never as the message.
- **Never blame the user.** "Número inválido" → "O número deve ter 9 dígitos, começando por 8."
- **Always offer a path forward.** Retry, alternative, or support. A dead end is never acceptable.
- **Scope errors to what failed.** A failed recommendations carousel must not take down the product
  page it sits on.
- **Preserve user input.** A failed form re-renders with every field intact. Losing a typed address
  on a phone keyboard over 3G is how you lose the order.

### Payment errors specifically

| Cause                 | Message (PT)                                                                                | Actions                         |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| Insufficient balance  | "Saldo insuficiente na sua conta M-Pesa."                                                   | Retry · Change method · Try COD |
| Wrong PIN             | "PIN incorrecto. Tente novamente."                                                          | Retry                           |
| User cancelled        | "Cancelou o pagamento."                                                                     | Retry · Change method           |
| Timeout / no response | "O pedido expirou. Não foi cobrado nada."                                                   | Retry · Change method           |
| Provider unavailable  | "O M-Pesa está temporariamente indisponível."                                               | Try e-Mola · Try COD            |
| Unknown               | "Não conseguimos confirmar o pagamento. Estamos a verificar — avisamos por SMS em minutos." | Go to orders                    |

The unknown case is the one that matters. We must **never** tell a user a payment failed when we do
not know, because they may have been debited. The honest message plus server-side reconciliation is
the only safe handling — and it is the difference between a support ticket and a lost customer who
tells everyone they were robbed.

## 5. Offline behaviour

### What works offline

| Feature                 | Offline    | How                                                              |
| ----------------------- | ---------- | ---------------------------------------------------------------- |
| Browse cached catalogue | ✅         | Last-viewed categories and products, IndexedDB / MMKV, 7-day TTL |
| Recently viewed         | ✅         | Local, always                                                    |
| View cart               | ✅         | Cart is local-first, server-reconciled                           |
| Edit cart               | ✅ queued  | Optimistic + retry queue (D-12)                                  |
| Wishlist toggle         | ✅ queued  | Same                                                             |
| View past orders        | ✅         | Cached order list and details, marked with age                   |
| Write a review          | ✅ queued  | Draft persisted, submitted on reconnect                          |
| Search                  | ⚠ partial | Cached results and history only; new queries need network        |
| **Checkout**            | ❌         | Explicitly blocked, with explanation                             |
| **Payment**             | ❌         | Explicitly blocked                                               |

### Why checkout is deliberately blocked

Queueing a checkout would mean the user believes they have ordered while stock, price, and payment
are all unverified. The failure modes — overselling, a price that moved, a duplicate payment on
reconnect — all cost money and trust. The line is drawn exactly where money moves (D-12).

The blocked message names what to do rather than simply refusing:

> **Sem ligação à internet**
> Precisa de internet para finalizar a compra. O seu carrinho está guardado.
> [ Tentar de novo ]

### The retry queue

- Persisted to disk, survives app termination.
- Exponential backoff: 1s → 2s → 4s → 8s → 30s → 60s, capped.
- Every mutation carries an idempotency key, so a retry that actually succeeded the first time
  cannot double-apply.
- Queue depth is visible to the user ("2 alterações por sincronizar"); an invisible queue that
  silently drops work is worse than no queue.
- Conflicts resolve server-authoritative, and the user is told when their local change lost —
  e.g. a queued quantity increase against stock that ran out.
- Entries older than 24 hours are discarded with a notification rather than replayed blindly
  against stale conditions.

## 6. Degraded-mode image policy

As the connection degrades, image quality steps down rather than images failing:

| Connection | Grid thumbs            | PDP hero              | Gallery          |
| ---------- | ---------------------- | --------------------- | ---------------- |
| Wi-Fi / 4G | Full (20KB AVIF)       | Full (80KB)           | Prefetch 2 ahead |
| 3G         | Full                   | Reduced (50KB)        | On demand only   |
| Slow / 2G  | LQIP only until tapped | Reduced               | On demand        |
| Offline    | Cached or placeholder  | Cached or placeholder | Cached           |

A "Poupar dados" toggle in Account forces the lowest tier permanently — and it is surfaced
proactively the first time we detect a sustained slow connection, rather than hidden in settings
for people who already know to look.

## 7. State inventory per component

Contract for Phase 3 implementation. Each component ships every applicable state, in both themes,
covered by tests.

| Component             | Default | Loading        | Empty | Error                 | Offline      | Disabled     | Focus |
| --------------------- | ------- | -------------- | ----- | --------------------- | ------------ | ------------ | ----- |
| `ProductGrid`         | ✓       | skeleton       | ✓     | ✓                     | stale marker | —            | ✓     |
| `ProductCard`         | ✓       | skeleton       | —     | broken-image fallback | cached       | out-of-stock | ✓     |
| `Cart`                | ✓       | skeleton       | ✓     | ✓                     | queued badge | —            | ✓     |
| `CheckoutStepper`     | ✓       | ✓              | —     | ✓                     | blocked      | ✓            | ✓     |
| `PaymentPending`      | ✓       | inherent       | —     | ✓                     | recovers     | —            | ✓     |
| `OrderStatusTimeline` | ✓       | skeleton       | ✓     | ✓                     | stale marker | —            | ✓     |
| `Button`              | ✓       | inline spinner | —     | —                     | —            | ✓            | ✓     |
| `PhoneInput`          | ✓       | —              | —     | ✓                     | —            | ✓            | ✓     |
| `OtpInput`            | ✓       | verifying      | —     | ✓                     | blocked      | locked out   | ✓     |
| `SearchField`         | ✓       | ✓              | ✓     | ✓                     | history only | —            | ✓     |
| `VendorDashboard`     | ✓       | skeleton       | ✓     | ✓                     | stale marker | —            | ✓     |

---

## Phase 1 complete

| Document                                                        |                                             |
| --------------------------------------------------------------- | ------------------------------------------- |
| [00 · Product Context](00-product-context.md)                   | Constraints, personas, assumptions          |
| [01 · Information Architecture](01-information-architecture.md) | Sitemaps, navigation, taxonomy, entities    |
| [02 · User Flows](02-user-flows.md)                             | Buyer, vendor, admin, payment state machine |
| [03 · Design System](03-design-system.md)                       | Colour, type, spacing, components, a11y     |
| [04 · Key Screens](04-key-screens.md)                           | 14 screen specifications                    |
| 05 · States & Connectivity                                      | This document                               |

**Awaiting your sign-off before Phase 2 (Architecture).**
Blocking items: [OQ-2](../../OPEN_QUESTIONS.md) (cloud provider), [OQ-3](../../OPEN_QUESTIONS.md)
(React Native), and the merchant-agreement items OQ-7/OQ-8 which you must initiate now because they
are the longest lead time in the project.
