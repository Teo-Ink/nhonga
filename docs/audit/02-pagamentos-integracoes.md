# 02 — Pagamentos e integrações

**Pontuação: 7/10**

## Resumo

O checkout alojado (`apps/api/src/modules/checkout`) foi pensado para dinheiro
real:

- valores em centavos inteiros;
- uma intenção por pagamento;
- crédito exactamente uma vez, numa transacção com `UPDATE` condicional;
- valores diferentes vão para revisão;
- failover só em erros de rede ou 5xx;
- varrimento periódico;
- o webhook é só um sinal: o estado é sempre perguntado ao gateway.

Os dados de cartão nunca passam pelos nossos servidores (página alojada da
PaySuite), por isso o âmbito PCI-DSS é o mínimo (SAQ A). Os testes com
Postgres estão em `audit/TEST-02-integracao-checkout`.

## Achados

### PAG-001 — Fluxo de dinheiro sem testes de integração

- Severidade: Alta · **Estado: corrigido em `audit/TEST-02-integracao-checkout`**
- Cobre:
  - 10 webhooks em paralelo → um só crédito;
  - valor diferente → revisão;
  - pagamento depois de expirar → creditado;
  - falha;
  - failover;
  - referência desconhecida;
  - pacote com bónus.
- Falta o job de CI com Postgres (proposto em `ci/ci.yml.proposta`).

### PAG-002 — Pagamentos em "review" só ficam no log

- Severidade: Média · Bloqueia: Não
- Evidência: `checkout.service.ts` regista
  `log.error('intent … needs review')` e não faz mais nada.
- Recomendação: alarme a partir do log (filtro de métrica como em OPS-02),
  lista de revisão num backoffice e procedimento de reembolso.
- Esforço: S (alarme) / M (backoffice)

### PAG-003 — Não há reembolsos nem estornos

- Severidade: Média
- Evidência: o contrato `CheckoutGateway` não tem `refund`, e não há estado
  `refunded`.
- Recomendação: definir a política de reembolso (jurista). Implementar
  `refund` na PawaPay (API v2) e na PaySuite e registar
  `wallet_transaction kind=refund`.
- Esforço: M

### PAG-004 — PawaPay: e-Mola depende de acordo comercial

- Severidade: Informativa. Na tabela pública, receber por e-Mola exige
  "contactar vendas" e as integrações Movitel são Enterprise. Até lá, o e-Mola
  vai pela PaySuite (reserva), que custa 6%.

### PAG-005 — Transferência bancária só aparece no texto

- Severidade: Média **[DECISÃO]**. Os textos referem "transferência bancária"
  (PR #6), mas o checkout só tem M-Pesa, e-Mola e cartão. Decidir entre
  implementar (referência + reconciliação manual ou extracto) ou retirar do
  texto.

### PAG-006 — Módulo de pagamentos legado com código morto

- Severidade: Baixa
- Evidência: `apps/api/src/modules/payments` (encomendas, provedores directos;
  em live só regista COD). O OpenAPI ainda lista `mkesh` em
  `paymentProvider`.
- Recomendação: decidir com CONT-01. Se a Nhonga for de classificados, remover
  o fluxo de encomendas ou isolá-lo atrás de uma flag.

### PAG-007 — Webhook da PawaPay sem verificação de assinatura

- Severidade: Baixa
- Evidência: só a PaySuite verifica HMAC; a PawaPay aceita o corpo e lê o
  estado de novo.
- Impacto: nenhum crédito indevido (o estado vem da API autenticada), mas um
  atacante pode forçar consultas. Activar a assinatura de callbacks da PawaPay
  (RFC 9421) quando a conta existir.

### PAG-008 — Integrações sem circuit breaker

- Severidade: Baixa. Há timeouts (`requestJson`) e failover, mas não há
  circuit breaker. Com dois gateways e baixo volume, chega por agora.

## O que está bem

- Dinheiro em centavos `bigint`, sem floats.
- Idempotência por intenção; `UPDATE … WHERE status IN (…)` com o crédito na
  mesma transacção.
- PaySuite: HMAC `X-Signature` sobre o corpo cru (preservado pelo novo parser
  em SEC-07).
- Credenciais só por ambiente; o modo live sem credenciais falha no arranque;
  a produção recusa `CHECKOUT_MODE=mock`.
- Números MZ normalizados (`+258`), prefixos de operador validados.
