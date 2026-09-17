# 03 · Design System

Phase 1 · Design | Status: awaiting sign-off
Machine-readable source: [`packages/design-tokens/tokens.json`](../../packages/design-tokens/tokens.json)

---

## 1. Direction

**Confident, plain, and unhurried.** The category default — saturated red-orange, countdown timers,
strikethrough prices everywhere, dense stacked badges — communicates *urgency*. We need to
communicate *reliability*, because the binding constraint is trust, not impulse (product context
§2.3). A buyer sending mobile money to a stranger for goods that arrive later needs the interface to
feel like a shop, not like a sale ending in four minutes.

Practically this means: generous whitespace instead of maximum density; one accent colour used
sparingly instead of five competing ones; real vendor identity given room; typography that is
legible on a cracked 720p screen in daylight rather than typography that is clever.

### Principles

1. **Trust is the feature.** If a layout decision trades clarity about *who is selling* and *what
   happens if it goes wrong* for density or delight, clarity wins.
2. **Every byte is the user's money.** Not a performance metric — a cost we impose on them.
3. **Degraded is a design state, not a failure.** Offline, slow, stale, and pending each get a
   designed treatment. They are not edge cases here; they are Tuesday.
4. **One hand, standing, bad light.** The reference posture is a commuter on a *chapa*, not a
   designer at a desk.
5. **Colour carries meaning, so spend it carefully.** Green is the brand and the primary action.
   Amber means commerce. Red means loss. Nothing decorative uses these.

## 2. Colour

Full palette in `tokens.json`. The decisions that matter:

**Verde Nhonga (`primary-700` `#0A5539`)** anchors brand and primary actions, at 9.1:1 on white.
Chosen over the category-standard orange-red both to differentiate and because green reads as safe
in a product whose main job is feeling safe (D-07).

**Âmbar (`accent-600` `#B35F00`)** is rationed. It appears on exactly four things: the buy-now
action, sale badges, discounted prices, and rating stars. Because it appears nowhere else, "amber
means money is about to move" becomes learnable within a session. Filled amber buttons must use
`accent-600` or darker — `400` and `500` fail contrast with white text.

**Warm neutrals** rather than blue-greys, so the green does not read as clinical.

### Contrast floors (enforced, not aspirational)

| Pair | Ratio | WCAG |
|---|---|---|
| `text-primary` on `bg-surface` | 17.4:1 | AAA |
| `text-secondary` on `bg-surface` | 7.3:1 | AAA |
| `text-tertiary` on `bg-surface` | 5.1:1 | AA |
| White on `action-primary` | 8.9:1 | AAA |
| White on `action-buy` | 4.6:1 | AA |
| White on `action-destructive` | 6.6:1 | AA |
| `border-default` on `bg-surface` | 1.9:1 | AA non-text (≥3:1 where a border *is* the control boundary — use `border-strong`) |

`neutral-400` and lighter are never used for text. `neutral-500` is the lightest permitted, and only
for tertiary metadata.

Colour is never the sole carrier of meaning: order states pair colour with an icon and a label;
stock warnings pair colour with text; form errors pair colour with an icon and a message.

### Dark mode

Not a nicety. Entry-level Android phones increasingly ship OLED panels, and a dark UI measurably
extends battery life for a user who may not be able to charge conveniently. Both themes are
first-class and both are contrast-tested.

## 3. Typography

**Web:** Inter, subset to `latin` + `latin-ext` (~15KB woff2), `font-display: swap`, self-hosted —
no third-party font CDN request on the critical path.
**Mobile:** the platform font (Roboto / SF). Zero font bytes over the network (D-09). The slight
cross-platform inconsistency is worth ~40KB on every cold start.

Latin-ext is required, not optional: Portuguese needs `ã õ ç á é í ó ú â ê ô à`. A font subset that
drops them renders Mozambican Portuguese as tofu.

### Scale

| Token | Size | Use |
|---|---|---|
| `4xl` 36 | Desktop page titles only |
| `3xl` 30 | Mobile page titles, price on PDP |
| `2xl` 24 | Section headings, cart total |
| `xl` 20 | Card titles, modal titles |
| `lg` 18 | Prominent body, product name on PDP |
| `md` 16 | **Body default.** All form inputs — 16px prevents iOS Safari's auto-zoom on focus |
| `sm` 14 | Secondary text, labels, product name in grid |
| `xs` 12 | Metadata, timestamps, legal |
| `2xs` 11 | Badge text only. Never a sentence. |

**14px is the floor for anything the user must read.** Portuguese runs 15–25% longer than English
(D-01), so every component spec below assumes two-line wrapping where English would take one, and
nothing truncates a price, a vendor name, or a status label.

### Numerals

Prices, quantities, and totals use tabular figures (`font-variant-numeric: tabular-nums`) so digits
align vertically in cart and settlement tables. Order references and tracking codes use the mono
stack — they get read aloud over the phone and transcribed.

### Currency (D-06)

One formatter, `formatMZN()`, in `packages/shared`:

```
formatMZN(1250000)  →  "12.500,00 MT"     // input is integer centavos
formatMZN(50000)    →  "500,00 MT"
formatMZN(0)        →  "0,00 MT"
```

Period thousands separator, comma decimal, `MT` trailing after a non-breaking space so the amount
never wraps away from its symbol. Native `Intl` output is explicitly not trusted — it varies by ICU
build and emits `MTn`/`MZN` inconsistently, and inconsistent price rendering damages trust directly.

## 4. Spacing and layout

4px grid. Mobile gutter 16px, tablet 24px, desktop 32px. Max content width 1280px.

**Grid columns by breakpoint** (product grids):

| Breakpoint | Columns | Note |
|---|---|---|
| 360–479 | 2 | The reference device |
| 480–767 | 2 | Larger cards, not more of them — legibility over density |
| 768–1023 | 3 | |
| 1024–1279 | 4 | |
| ≥1280 | 5 | |

Two columns at 360px gives a 164px card — enough for a readable 14px product name over two lines
and a 16px price. Three columns at that width, which several competitors use, produces a ~105px
card where the name truncates and the price shrinks below the legibility floor.

## 5. Component inventory

Twenty-eight components for v1. Each will ship with all states, both themes, and a11y annotations.

### Primitives
`Button` · `IconButton` · `Input` · `PhoneInput` · `OtpInput` · `Select` · `Checkbox` · `Radio` ·
`Switch` · `Textarea` · `Badge` · `Chip` · `Avatar` · `Skeleton` · `Spinner` · `Divider`

### Commerce
`PriceDisplay` · `RatingStars` · `ProductCard` · `ProductGrid` · `VendorCard` · `QuantityStepper` ·
`VariantSelector` · `StockIndicator` · `DeliveryEstimate` · `OrderStatusTimeline` ·
`PaymentMethodCard` · `CartVendorGroup`

### Feedback & structure
`EmptyState` · `ErrorState` · `OfflineBanner` · `Toast` · `BottomSheet` · `Modal` · `Tabs` ·
`Accordion` · `StickyActionBar` · `SearchField` · `FilterSheet` · `Stepper`

### Component specs worth fixing now

**`Button`**
| Variant | Fill | Text | Use |
|---|---|---|---|
| `primary` | `action-primary` | white | Confirm, submit, continue |
| `buy` | `action-buy` | white | Buy now, pay — money moves |
| `secondary` | transparent, `border-strong` | `text-primary` | Add to cart, cancel |
| `ghost` | transparent | `text-link` | Tertiary |
| `destructive` | `action-destructive` | white | Delete, cancel order |

Heights: `sm` 36 / `md` 48 / `lg` 56. **`md` is the default** — 48px is the touch minimum, so the
comfortable default is also the accessible one. Radius `md`. Full-width on mobile for primary
actions. Every button has an explicit loading state that keeps its width (no layout shift) and
disables re-submission — critical on the pay button, where a double tap must never mean two
payments.

**`PriceDisplay`** — current price in `text-price` at `lg`+ semibold with tabular figures; original
price struck through in `text-tertiary` at `sm`; discount as an amber `Badge`. Screen readers get
`"500,00 meticais, reduzido de 700,00 meticais"` via `aria-label`, never the raw strikethrough
markup.

**`ProductCard`** — 1:1 image (`grid-thumb` budget, LQIP placeholder, lazy below fold); product name
`sm`, two lines, ellipsis; price `md` semibold; rating + count `xs`; vendor name `xs` with verified
badge; optional free-delivery chip. Entire card is one tap target with a 48px minimum height on its
action area. **No hover-only information** — the primary platform has no hover.

**`OrderStatusTimeline`** — vertical on mobile, one entry per state, each with icon + label +
timestamp + optional detail. Current state is emphasised; future states are `text-tertiary`.
Renders per `SubOrder` (D-11). This component does the heaviest trust work in the product, so it
over-communicates: an explicit line for what happens next and by when, even when nothing has
changed since the last update.

**`PhoneInput`** — `+258` locked prefix, numeric keypad, formats as `84 123 4567`, and shows the
detected operator inline (Vodacom/Movitel/Tmcel) — which both reassures the user the number is right
and sets up the payment pre-selection in D-05.

**`OtpInput`** — six single-character boxes, numeric keypad, `autocomplete="one-time-code"` plus
Android SMS Retriever, auto-advance, auto-submit on the sixth digit, paste-aware. A visible resend
countdown, and after two failed sends an offer to try a different channel. Minimising friction here
matters more than anywhere else — it sits directly in the first-purchase funnel.

## 6. Iconography

Outline, 1.5px stroke, 24px grid, rendered as inline SVG from a tree-shaken set — no icon font
(icon fonts ship the whole alphabet for the twelve glyphs we use, and fail visibly when the font
does). Icons that carry meaning alone get an `aria-label`; decorative icons get `aria-hidden`.

## 7. Accessibility

Target: **WCAG 2.1 AA**.

- **Touch targets ≥ 48×48dp with ≥ 8dp between them.** No exceptions, including icon-only buttons,
  close buttons, quantity steppers, and star ratings. This is the rule most often quietly broken in
  e-commerce UI and the one most punishing on a low-end device with an imprecise touchscreen.
- Visible focus on every interactive element (2px `border-focus`, 2px offset), never removed.
- Full keyboard operability on web; logical tab order; skip-to-content link.
- Mobile screen readers (TalkBack, VoiceOver): every control labelled in the active language, images
  carry meaningful alt text from vendor data, live regions announce cart and payment changes.
- Form errors are announced, tied to their field with `aria-describedby`, and stated in plain
  Portuguese — never a code, never "invalid input".
- Respects OS font scaling up to 200% without clipping or loss of function. Layouts are tested at
  200%; this is why nothing is a fixed-height text container.
- `prefers-reduced-motion` disables all non-essential animation.
- Language is declared per document and switches with the locale, so screen readers pronounce
  Portuguese as Portuguese.

## 8. Performance budgets

Enforced in CI. A pull request that exceeds them fails.

| Metric | Budget | Reference condition |
|---|---|---|
| First screen total transfer (Home) | 500KB | Cold cache |
| LCP | < 2.5s | Throttled 3G, 400ms RTT |
| TTI | < 5s | Same |
| JS bundle, initial route | < 180KB gzip | |
| Grid thumbnail | 20KB | 320×320 AVIF |
| PDP hero | 80KB | 1080w |
| Android app cold start | < 3s | Reference device: 3GB RAM, entry-level SoC |
| APK download size | < 25MB | Play Store; users pay for this download |
| Frame rate while scrolling a grid | ≥ 50fps | Reference device |

The reference device is deliberately a low-end Android (D-03). Budgets validated on flagship
hardware describe a product our users do not have.

## 9. Localisation rules

- All strings in `pt-MZ` and `en` bundles from day one. No string is ever concatenated from
  fragments — Portuguese word order and gender agreement break it.
- ICU MessageFormat for plurals and gender. `{count, plural, one {# produto} other {# produtos}}`.
- Every component laid out with **+25% text expansion headroom** over English.
- Dates `dd/mm/yyyy`; times 24-hour; timezone `Africa/Maputo` (CAT, UTC+2, no DST).
- Phone numbers stored E.164 (`+258841234567`), displayed nationally (`84 123 4567`).
- The locale switch is in Account *and* in the onboarding flow — a user who cannot read the
  interface cannot navigate to the setting that fixes it.
- Not RTL-ready, and that is a deliberate scope decision rather than an oversight: no planned
  locale requires it, and logical CSS properties are used anyway so it stays cheap if that changes.

---

**Next:** [04 · Key Screens](04-key-screens.md)
