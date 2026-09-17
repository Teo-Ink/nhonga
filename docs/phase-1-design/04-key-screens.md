# 04 · Key Screens

Phase 1 · Design | Status: awaiting sign-off

Fourteen screens that define the product. Wireframes are drawn at the 360px reference width (D-03);
desktop adaptations are described where they differ meaningfully. A rendered, interactive version
of the design system and several of these screens accompanies this document as a published
prototype.

---

## 1 · Home (`/`)

```
┌─────────────────────────────────────┐
│ Nhonga      [🔍 Pesquisar…]    PT ▾ │ ← header 56px, sticky
├─────────────────────────────────────┤
│ ⚠ Pagamento pendente · Pedido #4821 │ ← only when a payment is AWAITING_USER
│   Toque para ver          [Ver →]   │
├─────────────────────────────────────┤
│ Categorias                          │
│ ┌────┐┌────┐┌────┐┌────┐            │ ← horizontal scroll, 12 items
│ │📱  ││👗  ││🏠  ││🔧  │            │   icon + label, 72px targets
│ │Tele││Moda││Casa││Ferr│            │
│ └────┘└────┘└────┘└────┘            │
├─────────────────────────────────────┤
│ Continuar a ver            (local)  │ ← from cache, renders with zero network
│ ┌──────┐┌──────┐┌──────┐            │
├─────────────────────────────────────┤
│ Populares perto de si               │
│ ┌────────────┐ ┌────────────┐       │
│ │  [imagem]  │ │  [imagem]  │       │ ← 2-col, 1:1, LQIP → lazy
│ │ Auscultado…│ │ Vestido de…│       │   name 14px / 2 lines
│ │ 1.250,00 MT│ │   850,00 MT│       │   price 16px semibold
│ │ ★4,6 (23)  │ │ ★4,8 (112) │       │
│ │ ✓ Loja Cri…│ │ ✓ Nélia Mo…│       │ ← vendor + verified badge
│ └────────────┘ └────────────┘       │
│         … lazy, 1 screen ahead …    │
├─────────────────────────────────────┤
│  🏠      ☰       🛒³      📦      👤 │ ← 60px, 5 tabs, badge on cart/orders
│ Início Categ.  Carrinho Pedidos Conta│
└─────────────────────────────────────┘
```

**The pending-payment banner is the most important element on this screen.** A user who paid, lost
signal, and reopened the app must find the truth immediately rather than hunting for it (user flows
§2). It persists until the payment resolves.

"Continuar a ver" renders from local cache before any network request completes, so the app is
never blank on launch — including with no connectivity at all.

*Desktop:* header with mega-menu, 5-column grid, no bottom nav, banner becomes a top strip.

---

## 2 · Search results (`/pesquisa?q=`)

```
┌─────────────────────────────────────┐
│ ←  [auscultadores        ]      ✕   │
├─────────────────────────────────────┤
│ 248 resultados                      │
│ [⚙ Filtros ³] [Relevância ▾]        │ ← sticky; badge = active filter count
│ [Maputo ✕][< 2.000 MT ✕]            │ ← active filters as removable chips
├─────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐       │
│ │ ProductCard│ │ ProductCard│       │
└─────────────────────────────────────┘
```

Filters open as a bottom sheet, not a side drawer: reachable by thumb, and it can be dismissed by
swiping down without a precise tap on a close button. Filters apply on "Aplicar" rather than
instantly — each instant application is a network round trip the user pays for.

Active filters stay visible as removable chips. A user who cannot see why a result set is empty
assumes the marketplace has nothing, which is the worst possible conclusion for a young catalogue.

---

## 3 · Product detail (`/produto/{slug}-{id}`)

The highest-stakes screen in the product: where the trust decision is made.

```
┌─────────────────────────────────────┐
│ ←                        ♡    ⤴     │ ← back, wishlist, share (WhatsApp first)
├─────────────────────────────────────┤
│                                     │
│          [ imagem 1:1 ]             │ ← swipeable, ≤80KB hero, lazy rest
│                                     │
│            ● ○ ○ ○                  │
├─────────────────────────────────────┤
│ 1.250,00 MT      1.700,00 MT  -26%  │ ← price 30px · struck 14px · amber badge
│ Auscultadores Bluetooth sem fios    │ ← 18px, up to 3 lines, never truncated
│ ★★★★☆ 4,6 · 23 avaliações           │
├─────────────────────────────────────┤
│ Cor                                 │
│ [Preto] [Branco] [Azul ⃠]            │ ← unavailable shown, disabled, not hidden
├─────────────────────────────────────┤
│ 🟡 Apenas 3 em stock                │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🏪 Loja Cristal      ✓ Verificado│ │ ← vendor card: prominent, tappable
│ │ ★4,7 · 1.240 vendas · Maputo    │ │
│ │ Responde em ~2h                 │ │
│ │                    [Ver loja →] │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 🚚 Entrega em Maputo · 150,00 MT    │
│    2–4 dias úteis                   │ ← computed for the user's saved address
│ 🛡 Proteção ao comprador             │ ← dispute rights, BEFORE purchase
│ ↩ Devoluções até 7 dias             │
├─────────────────────────────────────┤
│ Descrição ▾ · Especificações ▾      │ ← accordions, lazy-loaded bodies
│ Avaliações (23) ▾ · Perguntas (5) ▾ │
├─────────────────────────────────────┤
│ [ Adicionar ao carrinho ][ Comprar ]│ ← sticky, 56px; secondary + amber buy
└─────────────────────────────────────┘
```

Four decisions worth defending:

- **The vendor card sits above the fold-ish**, not in a footnote. On a marketplace where the buyer
  is trusting a stranger, "who is selling this" is as material as the price.
- **Buyer protection and returns appear before purchase.** Knowing recourse exists is what makes a
  first purchase possible; discovering it afterwards helps no one decide.
- **Unavailable variants are shown and disabled, not hidden.** Hiding them makes the catalogue look
  thinner than it is and leaves the buyer unsure whether the colour exists at all.
- **Delivery cost and time are shown on the PDP**, computed for a saved address. Shipping fees
  revealed at checkout are the leading cause of cart abandonment, and here they are large relative
  to order value.

*Desktop:* two columns — gallery left, buy panel sticky right, details full-width beneath.

---

## 4 · Cart (`/carrinho`)

```
┌─────────────────────────────────────┐
│ ← Carrinho (3)                      │
├─────────────────────────────────────┤
│ ┌─ 🏪 Loja Cristal ✓ ──────────────┐│ ← grouped by vendor from the start
│ │ ☑ [img] Auscultadores Bluetooth  ││
│ │        Preto                     ││
│ │        1.250,00 MT   [− 1 +] 🗑  ││
│ │ ☑ [img] Cabo USB-C 2m            ││
│ │          350,00 MT   [− 2 +] 🗑  ││
│ │ ─────────────────────────────────││
│ │ Subtotal          1.950,00 MT    ││
│ │ Entrega Maputo      150,00 MT    ││
│ │ Chega em 2–4 dias úteis          ││
│ └──────────────────────────────────┘│
│ ┌─ 🏪 Nélia Moda ✓ ────────────────┐│
│ │ ☑ [img] Vestido estampado M      ││
│ │          850,00 MT   [− 1 +] 🗑  ││
│ │ Subtotal            850,00 MT    ││
│ │ Entrega             100,00 MT    ││
│ │ Chega em 3–5 dias úteis          ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Total               3.050,00 MT     │ ← sticky bar
│ 3 artigos · 2 entregas              │ ← the multi-vendor reality, stated plainly
│ [    Finalizar compra    ]          │
└─────────────────────────────────────┘
```

"2 entregas" is deliberately explicit. Two parcels arriving on different days from different sellers
is not a bug, but it is a surprise — and an unexplained surprise after payment reads as something
going wrong (D-11).

Quantity changes apply optimistically and sync via the retry queue (D-12), so the cart stays
responsive on bad signal. Per-item checkboxes let a buyer part-order without deleting items they
intend to buy later.

---

## 5 · Checkout, step 1 — Delivery (`/checkout/entrega`)

```
┌─────────────────────────────────────┐
│ ←  Finalizar compra                 │
│  ●───────○───────○───────○          │
│ Entrega Pagam. Revisão  Fim         │
├─────────────────────────────────────┤
│ Entregar em                         │
│ ┌──────────────────────────────────┐│
│ │ ⦿ Casa                           ││
│ │   Bairro Polana Caniço A, Q.12   ││
│ │   Casa azul junto à bomba        ││ ← the landmark line (D-10)
│ │   Petromoc · Maputo, KaMaxaquene ││
│ │   84 123 4567           [Editar] ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ ○ + Adicionar nova morada        ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Método de entrega                   │
│ ⦿ Entrega ao domicílio   150,00 MT  │
│ ○ Levantar no vendedor       Grátis │
├─────────────────────────────────────┤
│ [        Continuar        ]         │
└─────────────────────────────────────┘
```

### The address form (D-10)

```
Província      [ Maputo Cidade      ▾ ]   ← required, dropdown
Distrito       [ KaMaxaquene        ▾ ]   ← required, filtered by province
Bairro         [ Polana Caniço A      ]   ← required, autocomplete + free text
Quarteirão/Casa[ Q.12, casa 34        ]   ← optional
Ponto de referência                        ← required — this is what finds the house
               [ Casa azul junto à    ]
               [ bomba Petromoc       ]
Telefone       [ +258 84 123 4567     ]   ← required, pre-filled from account
📍 [ Guardar localização actual ]          ← optional GPS, explicit permission
```

Four required fields plus a phone number, three of which are dropdowns. The landmark field is
required because in much of the country it is the field that actually delivers the parcel — while
delivery fees and zones key strictly off `distrito`, never off free text.

GPS is opt-in with a plain explanation of why. Silently harvesting location from someone
sceptical about a new marketplace is exactly the wrong trade.

---

## 6 · Checkout, step 2 — Payment (`/checkout/pagamento`)

```
┌─────────────────────────────────────┐
│ ←  Finalizar compra                 │
│  ●───────●───────○───────○          │
├─────────────────────────────────────┤
│ Como quer pagar?                    │
│ ┌──────────────────────────────────┐│
│ │ ⦿ [M] M-Pesa                     ││ ← pre-selected from prefix 84 (D-05)
│ │      84 123 4567                 ││
│ │      Confirma no seu telemóvel   ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ ○ [e] e-Mola                     ││
│ │      Usar outro número           ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ ○ 💵 Contra-entrega              ││ ← equal visual weight, not a footnote
│ │      Paga quando receber         ││
│ │      + 50,00 MT de taxa          ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Total a pagar       3.200,00 MT     │
│ [        Continuar        ]         │
└─────────────────────────────────────┘
```

COD is given the same visual weight as the wallets. For a first-time buyer it is frequently the only
acceptable option, and the first purchase is the one that converts a sceptic into a customer.

Whether the COD surcharge exists, and who pays the mobile-money fee, are open (OQ-5).

---

## 7 · Checkout, step 4 — Payment pending

The screen where trust is won or lost. It must be honest, calm, and survivable.

```
┌─────────────────────────────────────┐
│                                     │
│            ◐  (pulse)               │
│                                     │
│   Confirme no seu telemóvel         │
│                                     │
│   Enviámos um pedido de pagamento   │
│   para 84 123 4567.                 │
│   Introduza o seu PIN do M-Pesa.    │
│                                     │
│        3.200,00 MT                  │
│                                     │
│   ┌───────────────────────────────┐ │
│   │ ⏱ A aguardar… 1:42            │ │
│   └───────────────────────────────┘ │
│                                     │
│   Não recebeu o pedido?             │
│   [ Reenviar ]  [ Mudar método ]    │
│                                     │
│   Pode fechar esta página.          │ ← explicit permission to leave
│   Avisamos por SMS quando           │
│   estiver confirmado.               │
│                                     │
│   Pedido #4821                      │
└─────────────────────────────────────┘
```

Three deliberate choices:

- **Explicit permission to leave.** The user's battery may die, the *chapa* may enter a tunnel.
  Telling them the payment completes without them removes the fear that leaving loses their money.
- **No fake progress bar.** The wait is genuinely 10–120s and genuinely unpredictable; a progress
  bar that lies is worse than a timer that admits uncertainty.
- **"Mudar método" stays available.** A failed M-Pesa attempt should route to e-Mola or COD rather
  than out of the funnel.

On expiry the screen does not say "failed" — it says the request expired, offers a retry, and
states that if the payment is later confirmed the order will be honoured (user flows §2, rule 2).

---

## 8 · Order detail (`/pedidos/{id}`)

```
┌─────────────────────────────────────┐
│ ← Pedido #4821                      │
│ 15 set 2026 · 3.200,00 MT           │
├─────────────────────────────────────┤
│ ┌─ 🏪 Loja Cristal · 2 artigos ────┐│ ← one timeline PER VENDOR (D-11)
│ │ ● Confirmado      15 set · 14:32 ││
│ │ ● Em preparação   15 set · 16:10 ││
│ │ ● Expedido        16 set · 09:05 ││
│ │   Rastreio: MZ4821-A   [Copiar]  ││
│ │ ◉ Em trânsito                    ││ ← current state emphasised
│ │   Chega entre 17 e 19 de setembro││ ← what happens next, and by when
│ │ ○ Entregue                       ││
│ │                                  ││
│ │ [Contactar vendedor] [Problema?] ││
│ └──────────────────────────────────┘│
│ ┌─ 🏪 Nélia Moda · 1 artigo ───────┐│
│ │ ● Entregue        16 set · 11:20 ││
│ │ [ Confirmar recepção ]           ││
│ │ [ Avaliar ]   [ Problema? ]      ││
│ │ Confirmação automática em 6 dias ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Pagamento · M-Pesa · 3.200,00 MT    │
│ Ref: MPX7729401          [Copiar]   │ ← mono; users reconcile against their SMS
├─────────────────────────────────────┤
│ Entrega: Bairro Polana Caniço A…    │
└─────────────────────────────────────┘
```

Every timeline entry states what happens next and by when, even when nothing has changed. Silence
is the thing buyers interpret as theft.

The payment reference is prominent and copyable because buyers cross-check it against the
confirmation SMS from Vodacom or Movitel — that reconciliation is a trust ritual worth supporting.

---

## 9 · Vendor dashboard (`/vendor`) — phone-first

```
┌─────────────────────────────────────┐
│ Loja Cristal            ✓  🔔³      │
├─────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐     │
│ │ 3           │ │ 5           │     │
│ │ Novos       │ │ A expedir   │     │ ← biggest tap targets on the screen
│ │ pedidos     │ │             │     │
│ └─────────────┘ └─────────────┘     │
│ ┌─────────────┐ ┌─────────────┐     │
│ │ 2           │ │ 12.450 MT   │     │
│ │ Stock baixo │ │ A receber   │     │
│ └─────────────┘ └─────────────┘     │
├─────────────────────────────────────┤
│ Vendas · 7 dias                     │
│ ▁▃▅▂▇▄▆      18.200,00 MT           │ ← sparkline, inline SVG, no chart library
├─────────────────────────────────────┤
│ Precisa de atenção                  │
│ ⚠ Pedido #4830 aguarda há 18h       │
│ ⚠ "Cabo USB-C" — 2 em stock         │
├─────────────────────────────────────┤
│ [ + Adicionar produto ]             │
└─────────────────────────────────────┘
```

The dashboard is a to-do list, not a report. Nélia opens this between customers and needs to know
what to *do* — reports live under Análises for whoever wants them.

*Desktop:* same content, sidebar navigation, wider tables.

---

## 10 · Vendor · add product, step 1 (photos first)

```
┌─────────────────────────────────────┐
│ ← Adicionar produto                 │
│ ●───○───○───○   Fotos               │
├─────────────────────────────────────┤
│ Adicione fotos do produto           │
│ A primeira será a principal.        │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ [foto]  │ │ [foto]  │ │    +    │ │
│ │ Principal│ │       ✕ │ │ Câmara  │ │
│ └─────────┘ └─────────┘ └─────────┘ │
│ 💡 Fundo claro, produto centrado,   │
│    boa luz. Fotos boas vendem mais. │
│ Comprimidas automaticamente — usa   │
│ menos dados.                        │ ← the user pays for this upload; say so
├─────────────────────────────────────┤
│ [ Continuar ]      [Guardar rascunho]│
└─────────────────────────────────────┘
```

Photos precede the form because the seller has the product in hand and the camera is the step they
are motivated to complete (user flows §7). Images are compressed on-device before upload, and the
UI says so — data cost is the seller's objection too.

---

## 11 · Vendor · settlements (`/vendor/financas`)

```
┌─────────────────────────────────────┐
│ ← Finanças                          │
├─────────────────────────────────────┤
│ Saldo disponível                    │
│ 12.450,00 MT                        │
│ Próximo pagamento: 20 set           │
├─────────────────────────────────────┤
│ Pendente (em disputa)               │
│ 850,00 MT · 1 pedido       [Ver →]  │ ← withheld funds, never silently absent
├─────────────────────────────────────┤
│ Pedido #4821          15 set        │
│   Bruto                1.950,00 MT  │
│   Comissão (8%)         −156,00 MT  │ ← every deduction itemised
│   Taxa por pedido        −10,00 MT  │
│   Líquido              1.784,00 MT  │
├─────────────────────────────────────┤
│ [ Exportar CSV ]                    │
└─────────────────────────────────────┘
```

Every deduction is itemised per order. Opaque deductions are the fastest way to lose vendors, and
withheld disputed funds are shown explicitly rather than simply missing from the balance — money
that vanishes without explanation is how a marketplace loses its supply side.

---

## 12 · Admin · KYC queue (`/admin/vendedores`)

```
┌───────────────────────────────────────────────────────────────┐
│ Vendedores › Fila de aprovação (14)        [Filtros] [Ordenar]│
├───────────────────────────────────────────────────────────────┤
│ Nélia Moda · Individual · Beira        Submetido há 6h  [Ver] │
│   ✓ NUIT válido  ✓ Sem duplicados  ⚠ Titular difere           │
├───────────────────────────────────────────────────────────────┤
│ Detalhe (painel lateral)                                      │
│  [BI frente][BI verso][Selfie]   │  Nome: Nélia ...           │
│                                  │  NUIT: 1234...             │
│                                  │  Recebimento: 86 ...       │
│  ⚠ Titular da conta de           │  Loja: Nélia Moda          │
│    recebimento difere do BI      │                            │
│  [Aprovar] [Pedir informação] [Rejeitar — motivo obrigatório] │
└───────────────────────────────────────────────────────────────┘
```

Automated checks run before a human looks, and their results are shown as flags rather than
verdicts. Rejection requires a written reason — which is what makes appeals and any future
regulatory question answerable.

---

## 13 · Offline / degraded state

```
┌─────────────────────────────────────┐
│ ⚡ Sem ligação · a mostrar conteúdo  │ ← z-index above everything
│    guardado         [Tentar de novo]│
├─────────────────────────────────────┤
│ Populares perto de si    (guardado) │
│ ┌────────────┐ ┌────────────┐       │ ← cached catalogue remains browsable
│ │  [imagem]  │ │  [imagem]  │       │
├─────────────────────────────────────┤
│ 🛒 2 alterações por sincronizar     │ ← the retry queue, made visible
└─────────────────────────────────────┘
```

Offline is a designed state, not an error page. Cached catalogue stays browsable, cart edits queue
visibly, and the banner is honest about content being stale rather than pretending it is live.
Checkout, by contrast, is explicitly unavailable offline and says so — see D-12 and
[05 · States](05-states-and-connectivity.md).

---

## 14 · Empty states

Every empty state names a cause and offers an action. "Nothing here" is never sufficient — on a
young marketplace an empty result is far more likely to mean *our catalogue is thin* than *you
searched wrong*, and the copy should not blame the user for our gap.

```
┌─────────────────────────────────────┐
│              [ilustração]           │
│   Ainda não há resultados para      │
│   "auscultadores rosa"              │
│                                     │
│   Tente menos filtros ou outra      │
│   palavra.                          │
│                                     │
│   [ Remover filtros (3) ]           │ ← the likeliest actual cause, first
│   [ Ver auscultadores ]             │ ← broaden to the parent query
│                                     │
│   Avisar-me quando houver  [Ativar] │ ← turns our gap into demand signal
└─────────────────────────────────────┘
```

The "notify me" option converts a dead end into a demand signal that tells the platform which
categories to recruit vendors for — a genuinely useful input while the catalogue is small.

Full inventory of empty, error, loading, and connectivity states:
[05 · States & Connectivity](05-states-and-connectivity.md).

---

**Next:** [05 · States & Connectivity](05-states-and-connectivity.md)
