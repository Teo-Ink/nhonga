# 02 · User Flows

Phase 1 · Design | Status: awaiting sign-off

Diagrams are Mermaid; they render in GitHub, VS Code, and most Markdown viewers.

---

## 1. Buyer · First purchase (the flow that decides whether this product works)

The single most important journey. Every step where a first-time buyer could reasonably abandon is
marked ⚠ with its mitigation.

```mermaid
flowchart TD
    A[Chega via link WhatsApp / pesquisa] --> B[Página do produto - SSR, sem login]
    B --> C{Confia no vendedor?}
    C -->|Não| C1["⚠ Abandono<br/>Mitigação: badge de verificação, avaliações,<br/>localização, política de devolução visível"]
    C -->|Sim| D[Adicionar ao carrinho]
    D --> E[Carrinho - agrupado por vendedor]
    E --> F[Finalizar compra]
    F --> G{Tem sessão?}
    G -->|Não| H["Telefone +258 → OTP<br/>⚠ Abandono: SMS lento<br/>Mitigação: auto-preenchimento do OTP,<br/>reenvio em 30s, sem palavra-passe"]
    G -->|Sim| I
    H --> I[Passo 1 - Entrega]
    I --> I1["Morada: província → distrito → bairro<br/>+ ponto de referência<br/>⚠ Abandono: formulário longo<br/>Mitigação: dropdowns, GPS opcional,<br/>4 campos obrigatórios no total"]
    I1 --> J[Passo 2 - Pagamento]
    J --> J1{"Método<br/>(pré-selecionado pelo prefixo)"}
    J1 -->|84/85| K1[M-Pesa]
    J1 -->|86/87| K2[e-Mola]
    J1 -->|Escolha| K3["Contra-entrega<br/>⚠ Crítico para a 1ª compra"]
    K1 --> L[Passo 3 - Revisão]
    K2 --> L
    K3 --> L
    L --> L1["Total, por vendedor, com taxas de entrega<br/>e prazo estimado - sem surpresas"]
    L1 --> M[Confirmar e pagar]
    M --> N[Ecrã de pagamento pendente]
    N --> O{{Ver secção 2}}
```

**Total required input for a first purchase: phone number, OTP, four address fields.** No password,
no email, no card. That number is the design target and every added field must be defended.

## 2. Payment · The asynchronous push flow

This is the highest-risk flow in the product. Mobile-money push payments are asynchronous over an
unreliable channel: the callback can arrive late, twice, out of order, or never — while the user's
handset may already show success.

```mermaid
sequenceDiagram
    participant U as Comprador
    participant A as App / Web
    participant API as Nhonga API
    participant P as Provedor (M-Pesa / e-Mola)
    participant H as Telemóvel (USSD)

    U->>A: Confirmar e pagar
    A->>API: POST /checkout/pay (idempotency-key)
    API->>API: Order → PENDING_PAYMENT<br/>Payment → INITIATED
    API->>P: requestPayment(msisdn, amount, ref)
    P-->>API: 202 Aceite (transaction_id)
    API->>API: Payment → AWAITING_USER
    API-->>A: 202 + paymentId
    A->>U: "Confirme no seu telemóvel" + contador

    P->>H: Pedido push / USSD
    Note over U,H: Utilizador introduz o PIN.<br/>Pode demorar 10-120s.

    par Confirmação assíncrona
        P-->>API: Webhook (assinado, idempotente)
        API->>API: Verifica assinatura + chave de idempotência
        API->>API: Payment → PAID · Order → CONFIRMED
    and Polling de segurança
        A->>API: GET /payments/{id} (backoff: 2s→4s→8s, máx 3min)
        API->>P: queryStatus() se o webhook não chegou
    end

    API-->>A: PAID
    A->>U: Confirmação + SMS + push
```

### Payment state machine (D-14)

```mermaid
stateDiagram-v2
    [*] --> INITIATED
    INITIATED --> AWAITING_USER: provedor aceitou
    INITIATED --> FAILED: provedor rejeitou
    AWAITING_USER --> PAID: webhook / polling confirma
    AWAITING_USER --> FAILED: recusado / PIN errado / saldo insuficiente
    AWAITING_USER --> EXPIRED: sem resposta em 3 min
    EXPIRED --> INITIATED: nova tentativa (nova chave de idempotência)
    FAILED --> INITIATED: nova tentativa
    PAID --> REFUND_PENDING: reembolso iniciado
    REFUND_PENDING --> REFUNDED
    REFUND_PENDING --> REFUND_FAILED: intervenção manual
    PAID --> [*]
```

**The four rules this state machine exists to enforce:**

1. **Every transition is idempotent.** A webhook delivered three times produces one state change.
2. **`EXPIRED` is not `FAILED`.** The user may yet approve on the handset. Expiry closes the UI
   wait, but reconciliation continues server-side — and if a late approval lands, the order is
   honoured rather than the money being lost in limbo.
3. **The client never determines payment state.** It displays what the server says. A user with a
   confirmation SMS from Vodacom and a "pending" screen is a support ticket; a user whose client
   decided it was paid when it was not is a financial loss.
4. **Retry always issues a new idempotency key** for a new attempt, so a retry cannot be collapsed
   into the prior one — while a _duplicate_ of the same attempt still is.

### When the user disappears mid-payment

Closing the app, losing signal, or a dying battery must all be survivable:

- Payment state lives on the server; the client reconciles on next launch.
- A pending payment surfaces as a persistent banner on Home until it resolves.
- SMS is sent on resolution regardless of app state — the notification of last resort.
- A reconciliation job sweeps `AWAITING_USER` payments older than 3 minutes and queries the
  provider directly, so resolution never depends on the user returning.

## 3. Buyer · Order tracking and completion

```mermaid
stateDiagram-v2
    [*] --> AGUARDA_PAGAMENTO
    AGUARDA_PAGAMENTO --> CONFIRMADO: pagamento recebido
    AGUARDA_PAGAMENTO --> CANCELADO: expirado / falhou
    CONFIRMADO --> EM_PREPARACAO: vendedor aceitou
    CONFIRMADO --> CANCELADO: vendedor recusou → reembolso automático
    EM_PREPARACAO --> EXPEDIDO: vendedor expediu
    EXPEDIDO --> EM_TRANSITO
    EM_TRANSITO --> ENTREGUE
    ENTREGUE --> CONCLUIDO: confirmação do comprador ou 7 dias
    ENTREGUE --> DISPUTA: comprador contesta
    DISPUTA --> REEMBOLSADO
    DISPUTA --> CONCLUIDO: resolvida a favor do vendedor
    CONCLUIDO --> [*]
```

State transitions live at the **`SubOrder`** level, so a two-vendor order genuinely shows two
independent timelines. Attempting to collapse this into a single order status produces immediate
nonsense ("shipped" when half the order has not been).

**Notification policy** — each event fires push where available, with SMS fallback for the four
events that materially affect the buyer's money or plans:

| Event                | Push | SMS | Why SMS                                         |
| -------------------- | ---- | --- | ----------------------------------------------- |
| Pagamento confirmado | ✓    | ✓   | Money left their wallet; they need proof        |
| Vendedor aceitou     | ✓    | —   |                                                 |
| Expedido             | ✓    | ✓   | They may need to be present                     |
| Entregue             | ✓    | ✓   | Starts the 7-day dispute window                 |
| Disputa atualizada   | ✓    | ✓   | Money at stake                                  |
| Promoções            | ✓    | —   | Never SMS. Marketing SMS burns trust and money. |

SMS costs real money per message, so this table is a budget decision as much as a UX one.

**Auto-completion after 7 days** protects vendors from buyers who never confirm, which is the
common failure mode and would otherwise strand settlements indefinitely. The window is
admin-configurable.

## 4. Buyer · Review

Reviews are only possible from a **delivered `OrderItem`** (IA §8). Entry points: the post-delivery
notification, the order detail screen, and a persistent prompt in Orders.

```mermaid
flowchart LR
    A[Entregue] --> B[Notificação: avaliar]
    B --> C[Estrelas 1-5 - um toque]
    C --> D[Comentário opcional]
    D --> E[Fotos opcionais - máx 3, comprimidas no dispositivo]
    E --> F[Submeter - enfileirado se offline]
    F --> G{Moderação automática}
    G -->|Limpo| H[Publicado]
    G -->|Sinalizado| I[Fila de moderação admin]
```

The rating is one tap and everything after it is optional — this is deliberate. Review coverage,
not review depth, is what makes a marketplace navigable early on, and every required field cuts
completion sharply. Images are compressed on-device before upload (D-09).

## 5. Buyer · Dispute

Discoverable from the PDP _before_ purchase ("Proteção ao comprador"), not only afterwards.

```mermaid
flowchart TD
    A[Pedido entregue ou atrasado] --> B[Abrir disputa]
    B --> C{Motivo}
    C --> D[Não chegou]
    C --> E[Danificado / diferente do anúncio]
    C --> F[Em falta]
    D & E & F --> G[Evidência: fotos + descrição]
    G --> H[Vendedor notificado - SLA 48h]
    H --> I{Vendedor responde?}
    I -->|Aceita| J[Reembolso ou substituição]
    I -->|Contesta| K[Escalado para admin]
    I -->|Silêncio 48h| K
    K --> L[Admin analisa ambos os lados]
    L --> M[Decisão + registo de auditoria]
    M --> N[Reembolso via provedor original]
```

**Settlement hold:** funds for a disputed `SubOrder` are held and excluded from the vendor's next
payout until resolution. This is why `Settlement` is modelled per `SubOrder` (D-11) — a
platform-wide payout batch cannot selectively withhold one contested item.

## 6. Vendor · Onboarding and KYC

```mermaid
flowchart TD
    A[Vender na Nhonga] --> B[Telefone + OTP]
    B --> C[Tipo: individual ou empresa]
    C --> D1[Individual: BI/passaporte + selfie + NUIT]
    C --> D2[Empresa: NUIT + Alvará + BI do representante]
    D1 & D2 --> E[Dados da loja: nome, categoria, descrição, localização]
    E --> F[Conta de recebimento: M-Pesa / e-Mola / banco]
    F --> G["⚠ Titularidade deve corresponder à identidade verificada"]
    G --> H[Submeter para aprovação]
    H --> I[Estado: em análise - SLA 48h]
    I --> J{Decisão admin}
    J -->|Aprovado| K[Pode publicar - pode adicionar produtos antes disso]
    J -->|Mais informação| L[Pedido específico + reenvio]
    J -->|Rejeitado| M[Motivo registado + processo de recurso]
```

Two decisions that matter for supply acquisition:

- **Vendors can add products while KYC is pending**, but cannot publish. Onboarding drop-off is the
  main risk to supply, and dead waiting time is where it happens. Letting someone build their
  catalogue during the wait converts the wait into investment.
- **Payout account holder must match verified identity.** Mismatch is the single clearest fraud
  signal in marketplace payouts and the cheapest one to check.

Document capture is camera-first with on-device compression and an explicit legibility check —
Nélia is photographing her ID on a phone, and a rejected-for-blurriness loop is a classic
onboarding killer.

## 7. Vendor · Add a product (phone-optimised)

Four steps, each one screen, saved as draft after every step so a dropped connection never loses
work.

```mermaid
flowchart LR
    A["1 Fotos<br/>câmara ou galeria<br/>comprimidas no dispositivo<br/>1ª = principal"] --> B["2 Básico<br/>nome, categoria (sugerida),<br/>descrição"]
    B --> C["3 Preço e stock<br/>preço MZN, quantidade,<br/>variantes opcionais"]
    C --> D["4 Entrega<br/>peso/tamanho, prazo,<br/>zonas atendidas"]
    D --> E[Pré-visualizar → Publicar]
```

Photos come **first**, before the form. A phone-based seller has the product in front of them and
the photo is the part they are motivated to do; leading with the camera and following with typing
gets more listings finished than the conventional form-first order. Category is suggested from the
product name to avoid a three-level drill-down on a phone.

**Bulk upload** (Loja Cristal persona): CSV with a downloadable template, validated row-by-row with
errors reported per row rather than as a single failure, plus a ZIP of images matched by SKU.

## 8. Vendor · Order fulfilment

```mermaid
flowchart TD
    A[Novo pedido - push + SMS] --> B{Aceitar em 24h?}
    B -->|Aceitar| C[Em preparação]
    B -->|Recusar| D[Cancelado → reembolso automático + registo]
    B -->|Sem resposta 24h| D
    C --> E[Marcar como expedido + código de rastreio]
    E --> F[Em trânsito]
    F --> G[Entregue]
    G --> H[7 dias sem disputa]
    H --> I[Elegível para liquidação]
    I --> J[Incluído no ciclo de pagamento]
```

Repeated non-response degrades a vendor's ranking and, past a threshold, triggers admin review.
Auto-cancel exists because an unanswered order is worse for buyer trust than a declined one.

## 9. Vendor · Settlement

```mermaid
flowchart LR
    A[SubOrder concluído] --> B[Valor bruto]
    B --> C[- comissão da plataforma]
    C --> D[- taxa fixa por pedido]
    D --> E[- reembolsos / ajustes]
    E --> F[Saldo disponível]
    F --> G{Ciclo de pagamento}
    G --> H[Lote gerado → aprovação admin]
    H --> I[Desembolso via provedor]
    I --> J{Sucesso?}
    J -->|Sim| K[Liquidado + comprovativo]
    J -->|Não| L[Fila de falhas → intervenção manual]
```

Every deduction is itemised per order in the vendor's finance view. Opaque deductions are the
fastest way to lose vendors, and the transparency costs nothing to build if designed in now.
Settlement cadence and disbursement rail depend on OQ-4 and OQ-7/8.

## 10. Admin · Vendor approval

```mermaid
flowchart TD
    A[Fila KYC, ordenada por antiguidade] --> B[Analisar documentos lado a lado]
    B --> C{Verificações automáticas}
    C --> D[Formato NUIT · duplicados · listas de risco · correspondência do titular]
    D --> E{Decisão}
    E -->|Aprovar| F[Ativo + notificação]
    E -->|Pedir info| G[Pedido específico + reenvio]
    E -->|Rejeitar| H[Motivo obrigatório + recurso]
    F & G & H --> I[Registo de auditoria imutável]
```

A rejection reason is mandatory — not bureaucracy, but the thing that makes the appeal process and
any future regulatory question answerable.

## 11. Cross-cutting · Authentication (OTP)

```mermaid
flowchart TD
    A[Introduzir telefone +258] --> B{Limites de tentativas}
    B -->|Excedido| C[Bloqueio progressivo + captcha]
    B -->|OK| D[Enviar OTP de 6 dígitos - validade 5 min]
    D --> E[Auto-preenchimento - SMS Retriever Android / iOS autofill]
    E --> F{Verificar}
    F -->|Correto| G[Token de acesso 15min + refresh rotativo]
    F -->|Errado x5| H[Invalidar código + novo pedido obrigatório]
    G --> I{Utilizador novo?}
    I -->|Sim| J[Nome + idioma → concluído]
    I -->|Não| K[Sessão restaurada]
```

The abuse surface is treated as security-critical from Phase 1 (D-04): per-number, per-IP and
per-device rate limits, a global send-rate circuit breaker, progressive lockout, single-use codes
invalidated on success or on five failures, and a hard daily SMS spend cap. Every SMS costs money,
so an unprotected OTP endpoint is both a security hole and a direct financial drain.

---

**Next:** [03 · Design System](03-design-system.md)
