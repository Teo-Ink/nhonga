# 01 · Information Architecture

Phase 1 · Design | Status: awaiting sign-off

---

## 1. Three applications, one system

| Surface | Audience | Platform | Rationale |
|---|---|---|---|
| **Storefront** | Buyers | Web (Next.js) + Mobile (React Native) | Web must be first-class: it is how people arrive from WhatsApp and Facebook links, and it is how someone browses before they trust the product enough to install an app. |
| **Vendor console** | Sellers | Responsive web only | See D-02 rationale. A separate vendor native app would double mobile cost for an audience that will accept a good mobile web app. **It must be excellent on a phone** (persona: Nélia), not merely tolerable. |
| **Admin console** | Platform staff | Responsive web, desktop-optimised | Internal, low user count, high data density. |

A fourth implicit surface deserves naming: **the shared link**. Product and vendor pages must
render correctly as WhatsApp and Facebook previews, because that is the primary discovery channel
in this market. Open Graph metadata and server-rendered product pages are therefore a requirement,
not an SEO nicety — which is itself an argument for Next.js.

## 2. Storefront navigation model

### Mobile: five-tab bottom bar

Five is the maximum before tap targets shrink below the 48dp minimum on a 360dp-wide screen.

```
┌──────────────────────────────────────────────┐
│  Início    Categorias   Carrinho   Pedidos   Conta │
│   (Home)   (Categories)   (Cart)   (Orders)  (Account) │
└──────────────────────────────────────────────┘
```

**Why "Pedidos" (Orders) earns a permanent tab** — an unusual choice worth defending. In a
high-trust market it would be buried under Account. Here, the period between paying and receiving
is precisely when trust is most fragile, and the buyer will check repeatedly. Making order status
one tap from anywhere directly serves the binding constraint (§2.3 of the product context). It
also carries a badge for actionable states, which pulls people back into the app for the right
reason.

Search is not a tab; it is a persistent field in the header on Home and Categories, and a
full-screen overlay when focused.

### Web: persistent header + mega-menu

```
┌────────────────────────────────────────────────────────────────┐
│ [Nhonga]  [ Pesquisar produtos…            🔍]  PT▾  Conta  🛒 3 │
│ Categorias ▾ │ Ofertas │ Vender na Nhonga │ Ajuda               │
└────────────────────────────────────────────────────────────────┘
```

On viewports below 768px the web header collapses to the same bottom-tab model as the app, so the
mental model is identical across surfaces.

## 3. Storefront sitemap

```
Início (Home)
├── Feed: categorias em destaque, produtos populares, vendedores verificados
├── Continuar a ver (recently viewed — served from local cache, zero network)
└── Pesquisa (overlay)
    ├── Sugestões / histórico (local)
    └── Resultados
        └── Filtros: categoria · preço · avaliação · localização · vendedor
                     · entrega · condição · em stock

Categorias
├── Nível 1 (12 departamentos)
│   └── Nível 2
│       └── Nível 3 → listagem de produtos

Produto (PDP)  /produto/{slug}-{id}
├── Galeria · preço · variantes · stock
├── Vendedor (card: nome, badge, avaliação, localização, tempo de resposta)
├── Entrega: opções e prazo estimado para a morada do utilizador
├── Descrição · especificações
├── Avaliações e classificações
├── Perguntas e respostas
└── Produtos relacionados · mais deste vendedor

Loja do vendedor  /loja/{slug}
├── Cabeçalho: banner, badge de verificação, avaliação, políticas
├── Catálogo do vendedor (filtrável)
└── Sobre · políticas de devolução · contacto

Carrinho
└── Agrupado por vendedor → subtotal por vendedor → total geral

Checkout  (linear, 4 passos, sem navegação lateral)
├── 1 Entrega  (morada + método)
├── 2 Pagamento (M-Pesa · e-Mola · Contra-entrega)
├── 3 Revisão
└── 4 Confirmação / estado do pagamento

Pedidos
├── Ativos → detalhe do pedido → cronologia de estados
│                              ├── sub-pedido por vendedor
│                              ├── contactar vendedor
│                              ├── abrir disputa
│                              └── confirmar recepção → avaliar
└── Histórico → repetir encomenda

Conta
├── Perfil · idioma (PT/EN)
├── Livro de moradas
├── Lista de desejos
├── Avaliações que escrevi
├── Notificações
├── Ajuda e suporte  → tickets
└── Vender na Nhonga → onboarding de vendedor
```

### Why the cart is grouped by vendor from the first screen

The cart is where the multi-vendor reality must be made legible, and the *earliest* place it can
be is the right place. If the buyer first learns at checkout that their four items are three
separate shipments with three delivery fees arriving on three different days, that is a trust
failure at the worst possible moment. Grouping in the cart makes shipping fees and delivery windows
legible while the buyer can still act on them. See D-11.

## 4. Vendor console sitemap

Ordered for a phone, where the vendor sees roughly one section at a time.

```
Painel (Dashboard)
└── Hoje: novos pedidos · a expedir · stock baixo · saldo a receber

Pedidos
├── Novos → aceitar / recusar
├── A preparar → marcar como expedido (+ código de rastreio)
├── Em trânsito
└── Concluídos · Devoluções · Disputas

Produtos
├── Lista (pesquisa, filtro por estado, stock)
├── Adicionar produto  (assistente de 4 passos, otimizado para telemóvel)
├── Importação em massa (CSV + fotos) — desktop-first, disponível no telemóvel
└── Stock (edição rápida em lote)

Finanças
├── Saldo e próximo pagamento
├── Histórico de liquidações → exportar CSV
├── Comissões e taxas (transparente, por pedido)
└── Conta de recebimento (M-Pesa / e-Mola / banco)

Análises
└── Vendas · produtos mais vistos · taxa de conversão · avaliação média

Loja
├── Perfil público · banner · políticas
└── Horário e prazos de expedição

Conta
├── Verificação (KYC) e estado
├── Utilizadores da loja (permissões)
└── Ajuda
```

## 5. Admin console sitemap

```
Visão geral        → GMV, pedidos, taxa de sucesso de pagamentos, alertas
Vendedores         → fila de aprovação KYC · ativos · suspensos · histórico de decisões
Catálogo           → fila de moderação · categorias · atributos · produtos sinalizados
Pedidos            → pesquisa global · intervenção manual · reembolsos
Disputas           → fila com SLA · evidência de ambas as partes · resolução
Pagamentos         → transações · falhas · reconciliação · webhooks reprocessáveis
Liquidações        → ciclos de pagamento a vendedores · aprovação · falhas
Configuração       → comissões por categoria · taxas · impostos · zonas de entrega
Risco              → sinalizações de fraude · regras · listas
Conteúdo           → banners, páginas, traduções PT/EN
Utilizadores       → staff, funções (RBAC), registo de auditoria
```

Every admin action that touches money, vendor standing, or published content writes an immutable
audit record — actor, timestamp, before/after, reason. This is a §6 security requirement and an
operational one: a vendor whose listing is removed will ask why, and "we don't know" is not an
answer that retains supply.

## 6. Category taxonomy

Three levels maximum. Depth beyond three is where marketplace taxonomies rot — vendors
mis-categorise and buyers stop trusting filters.

Twelve level-1 departments, chosen for the local market rather than copied from a global template:

| PT | EN | Note |
|---|---|---|
| Telemóveis e Acessórios | Phones & Accessories | Expected to be the highest-volume department |
| Eletrónica | Electronics | |
| Moda Feminina | Women's Fashion | |
| Moda Masculina | Men's Fashion | |
| Casa e Cozinha | Home & Kitchen | |
| Beleza e Saúde | Beauty & Health | |
| Bebé e Criança | Baby & Kids | |
| Alimentos e Bebidas | Food & Beverages | Non-perishable only in v1 — perishables need cold chain |
| Ferramentas e Construção | Tools & Construction | Serves the Salvador persona |
| Agricultura | Agriculture | Genuinely significant locally; usually absent from global templates |
| Automóvel e Motos | Automotive & Motorcycles | |
| Desporto e Lazer | Sports & Leisure | |

Category attributes are typed and per-category (`size`, `colour`, `voltage`, `capacity`), which is
what makes filters and variants work. Attribute definitions are admin-managed, not hardcoded.

## 7. Route and URL scheme

Portuguese slugs, because these URLs are shared on WhatsApp and being readable matters.

| Route | Rendering | Note |
|---|---|---|
| `/` | SSR + ISR | |
| `/c/{cat}/{sub?}/{sub2?}` | SSR + ISR | Category listing |
| `/produto/{slug}-{id}` | SSR, revalidated | **Must** carry OG tags — primary share target |
| `/loja/{slug}` | SSR | Vendor storefront, also OG-tagged |
| `/pesquisa?q=` | SSR | Indexable |
| `/carrinho` | Client | |
| `/checkout/{step}` | Client, auth-gated | |
| `/pedidos`, `/pedidos/{id}` | Client, auth-gated | |
| `/conta/**` | Client, auth-gated | |
| `/vender` | SSR | Vendor acquisition landing page — a marketing surface |
| `/vendor/**` | Client, role-gated | Vendor console |
| `/admin/**` | Client, role-gated, IP-restricted | Admin console |

Mobile deep links mirror these paths exactly (`nhonga://produto/{slug}-{id}` plus universal/app
links), so a shared web link opens the app when installed.

## 8. Core entity map

Conceptual only — the normalised ERD is a Phase 2 deliverable. Shown here because IA decisions
imply it, particularly the order/sub-order split.

```
User ──< Address
 │
 ├──< Order ──< SubOrder ──< OrderItem >── ProductVariant >── Product >── Vendor
 │      │          │                                              │
 │      │          └──< Shipment ──< TrackingEvent                └──< Category
 │      │          └──< Settlement >── Vendor
 │      └──< Payment ──< PaymentEvent        (idempotent webhook log)
 │      └──< Dispute ──< DisputeMessage
 │
 ├──< Review >── OrderItem      (reviews require a delivered purchase)
 ├──< Question ──< Answer
 ├──< CartItem
 └──< WishlistItem

Vendor ──< VendorUser (RBAC)
       ──< KycDocument
       ──< PayoutAccount
```

Three structural points worth flagging now because they are expensive to retrofit:

1. **`Order` is the buyer's payment unit; `SubOrder` is the vendor's fulfilment and settlement
   unit.** One payment, N shipments, N settlements. (D-11)
2. **`Review` hangs off `OrderItem`, not off `Product`.** Only a verified delivered purchase can
   produce a review. This is the primary defence against review fraud, which would destroy the
   trust the whole product depends on.
3. **`PaymentEvent` is an append-only log keyed by provider idempotency key.** Mobile-money
   callbacks arrive late, duplicated, and out of order; the log plus the state machine (D-14) is
   how we stay correct when they do.

---

**Next:** [02 · User Flows](02-user-flows.md)
