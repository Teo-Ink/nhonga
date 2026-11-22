# Decisões pendentes (preparadas pelo agente; a decisão é do dono)

Cada decisão tem opções, custo, esforço e uma recomendação. Nada foi
implementado sem decisão.

## SEC-04 — Rate limiting partilhado entre instâncias

Hoje os contadores estão em memória em cada tarefa (API até 4, web até 3).

| Opção                        | O que é                                | Custo/mês                           | Esforço | Prós                                                          | Contras                                                        |
| ---------------------------- | -------------------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| A. Redis (ElastiCache)       | Contadores partilhados                 | ~15–30 USD (cache.t4g.micro)        | M       | Rápido, padrão                                                | Mais um serviço, mais um ponto de falha                        |
| B. Tabela Postgres           | Janela fixa com `INSERT … ON CONFLICT` | 0                                   | S       | Sem infra nova; já é o padrão do OTP (SEC-02)                 | Uma escrita por pedido limitado; não serve para o tráfego todo |
| C. AWS WAF rate-based no ALB | Limite por IP na borda                 | ~5 USD + 0,60 USD/milhão de pedidos | S       | Corta o abuso antes da app; também dá regras geridas (SEC-09) | Só por IP; muitos utilizadores atrás do mesmo NAT de operadora |

**Recomendado: C para IP + B para o assistente de IA e a publicação.** O OTP
já usa B (SEC-02). Decisão necessária: aprovar o custo do WAF (~10 USD/mês) e
a ordem.

## SEC-06 — Restringir o staging

Hoje qualquer pessoa entra com qualquer número (código no ecrã), publica, e em
modo mock reserva publicidade que fica visível.

| Opção                                    | Como                                                                           | Custo  | Esforço | Efeito                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ------ | ------- | ------------------------------------------------------------------------------- |
| A. WAF com allowlist de IPs              | Só os IPs da equipa                                                            | ~5 USD | S       | Fecha tudo; dificulta demos em redes móveis (IP muda)                           |
| B. Autenticação básica                   | `Authorization: Basic` no middleware do web e na API                           | 0      | S       | Fácil de partilhar numa demo; a palavra-passe pode vazar                        |
| C. Allowlist de números para o `devCode` | `OTP_DEV_ALLOWLIST=+25884…,+25886…`; outros números recebem "SMS indisponível" | 0      | S       | O site fica visível, mas só testadores entram; publicidade mock continua aberta |

**Recomendado: B + C** para demos e testes com parceiros. Também desligar
`POST /ads` em mock fora do desenvolvimento local.

## OPS-03 — RPO, RTO e Multi-AZ

| Item                    | Hoje (Terraform)                         | Proposta                                                     |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Backups automáticos     | 35 dias + PITR (5 min)                   | manter                                                       |
| RPO (perda máxima)      | ~5 min (PITR)                            | **15 min** como compromisso público                          |
| RTO (tempo para voltar) | não testado                              | **4 h** no arranque, **1 h** depois do primeiro ensaio       |
| Multi-AZ                | produção sim (~+60 USD/mês), staging não | manter; desligar só se o orçamento obrigar                   |
| Teste de restauro       | nunca                                    | trimestral, no staging (`docs/runbooks/backups-restauro.md`) |

Decisão necessária: aceitar o RPO/RTO e o custo do Multi-AZ.

## CONT-01 — Classificados ou marketplace transaccional

| Opção                                         | Implica                                                                                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classificados (recomendado para o lançamento) | Texto actual com a flag desligada; pagamentos só para serviços Nhonga (destaques, Loja Pro, publicidade); remover ou isolar encomendas, COD e "protecção ao comprador" |
| Marketplace                                   | Escrow ou pagamento retido, política de reembolsos, logística, KYC de vendedores, licença de pagamentos, termos de consumo; meses de trabalho                          |

## PAG-005 — Transferência bancária

Aparece no texto, mas não existe no checkout. A) Implementar: referência
única por intenção, reconciliação manual no backoffice, prazo de 48 h. B)
Retirar do texto até existir.

## CONT-03 / CONT-04 — Jurídico

Apostas (1xBet), termos, privacidade, cookies e eliminação de conta: ver
`15-conformidade-negocio.md`. É precisa uma reunião com o advogado antes da
produção.
