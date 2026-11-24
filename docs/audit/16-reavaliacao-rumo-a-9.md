# 16 — Reavaliação depois da segunda ronda (rumo à nota 9)

Data: 22/11/2026. Base: `main` + os 14 ramos da primeira ronda
(`audit/INT-integracao`) + 9 ramos novos, empilhados por esta ordem:

| Ramo                              | O que resolve                                                                                                                                           | Backlog                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `audit/INT-integracao`            | Junta os 14 PRs (#7–#20) e resolve o conflito em `layout.tsx`                                                                                           | —                                  |
| `audit/SEC-09-acessos`            | Admin fechado, publicar com sessão e limite diário, alertas da conta, limites partilhados em Postgres, allowlist do staging, SMS real, contas suspensas | P0-02, P0-03, P0-04, P0-05, P1-11  |
| `audit/CMP-01-conta-seguranca`    | Eliminar conta, exportar dados, bloquear, denunciar na app, ids da app, HTTPS na app, apostas recusadas                                                 | P0-06, P0-17, P0-18, P0-19 (parte) |
| `audit/DAT-01-pesquisa-bd`        | Pesquisa e navegação em SQL com índices, preço desnormalizado, expiração de anúncios                                                                    | P1-01, P2-10                       |
| `audit/OPS-04-observabilidade`    | Logs JSON com request id, Sentry, alarme de pagamentos em revisão, Dependabot, vulnerabilidades                                                         | P0-13, P1-07, P1-08, P1-09         |
| `audit/UX-02-registo-voce`        | Tratamento por "você" em todo o lado                                                                                                                    | P1-10                              |
| `audit/TEST-01-e2e-playwright`    | 7 fluxos E2E a 360 px + axe, correcções de contraste, login social escondido                                                                            | P1-05, P2-09                       |
| `audit/ARQ-05-media-s3`           | Fotos em S3 + CloudFront, migração das antigas                                                                                                          | P1-03, P1-04 (fotos)               |
| `audit/DSO-06-base-seguranca-aws` | WAF no ALB, CloudTrail, GuardDuty                                                                                                                       | P2-05                              |
| `audit/ARQ-02-documentacao`       | Arquitectura e inventário de rotas                                                                                                                      | P2-14                              |

Verificação local no último ramo: 182 testes da API (com Postgres), 16 do
web, 145 do pacote partilhado, typecheck e lint verdes; 12/12 E2E em três
execuções seguidas; p95 da pesquisa ≤ 143 ms com 50 000 anúncios
([evidências](evidencias/pesquisa-50k.md), [E2E](evidencias/e2e-axe.md)).
**Terraform não foi validado localmente** (o `terraform`/`tofu` não pôde
correr neste ambiente): o `fmt`, o `validate` e o plano correm no CI do PR.

## Notas por domínio

"Código" = com todos os ramos juntos ao `main`. "Com o dono" = depois das
tarefas que só o dono pode fazer (lista abaixo).

| Domínio        | 1.ª ronda | Código  | Com o dono | O que ainda falta para 9                                                 |
| -------------- | --------- | ------- | ---------- | ------------------------------------------------------------------------ |
| Segurança      | 5 → 7     | **8**   | 9          | HTTPS/domínio, chaves root, WAF em "block" após 2 semanas                |
| Pagamentos     | 7         | **8**   | 8,5        | Reembolsos (P2-02), decisão sobre transferência bancária                 |
| Arquitectura   | 6         | **8**   | 8          | Validação Zod centralizada (P2-01), retirar o fluxo de encomendas legado |
| API            | 6         | **7**   | 7          | OpenAPI completo, `/v1`, Idempotency-Key, Zod                            |
| Dados          | 6         | **8**   | 9          | RPO/RTO aprovados e ensaio de restauro (P0-11)                           |
| Performance    | 4 → 6     | **8**   | 8,5        | CDN para `/_next/static` (falta o domínio), Lighthouse em 3G real        |
| Escalabilidade | 6         | **8**   | 8,5        | NAT por AZ / VPC endpoints (P2-12)                                       |
| DevOps         | 6         | **7**   | 8,5        | Mover as propostas de CI/deploy, serviço web em produção (P0-08)         |
| DevSecOps      | 6         | **7**   | 9          | Protecção do `main`, chaves root, propostas de CI                        |
| Testes         | 4 → 6     | **8**   | 9          | Ligar o job E2E e o Postgres no CI (proposta pronta)                     |
| UX             | 6         | **8**   | 8,5        | Teste com 5 utilizadores reais em telemóvel                              |
| Design e cores | 8         | **9**   | 9          | —                                                                        |
| Acessibilidade | 6         | **8**   | 8,5        | TalkBack num Android real, mais páginas no axe                           |
| Mobile         | 4         | **6**   | 7          | Expo SDK 58 (3 vulnerabilidades altas), testes, build EAS para as lojas  |
| Conformidade   | 4         | **7**   | 9          | Termos e privacidade revistos pelo advogado, parecer sobre apostas       |
| **Global**     | 5,5 → 6,3 | **7,7** | **8,5**    |                                                                          |

## O caminho até 9

A nota 9 **não se atinge só com código**. Faltam três blocos:

1. **Tarefas do dono** (≈ 1 dia de trabalho, dependem de si):
   - registar o domínio e seguir `runbooks/https.md` (HTTPS, cookies
     `Secure`, app em HTTPS);
   - apagar as chaves root e usar um utilizador IAM com MFA;
   - ligar a protecção do `main` (checks obrigatórios, 1 revisão);
   - mover `docs/audit/ci/*.proposta` para `.github/workflows/`;
   - pôr os números da equipa no segredo `OTP_DEV_ALLOWLIST` do staging;
   - confirmar a subscrição dos alarmes no email;
   - criar o projecto Sentry e pôr o DSN em `sentry_dsn`;
   - decidir: modelo de negócio, transferência bancária, RPO/RTO,
     identificador da app (`mz.co.nhonga.app` proposto).
2. **Advogado**: termos e privacidade sem marcadores `[…]`, parecer sobre
   publicidade de apostas (por agora recusada).
3. **Engenharia restante** (≈ 2 semanas): API (Zod, OpenAPI completo, `/v1`),
   Expo SDK 58 e testes da app, reembolsos, serviço web em produção, CDN dos
   estáticos, NAT por AZ, WAF em modo "block".

Com 1 e 2 feitos, a nota global fica em **≈ 8,5**; com 3, chega a **9**.

## 3.ª ronda — API (22/11/2026)

Quatro ramos, empilhados depois de `audit/ARQ-02-documentacao`:

| Ramo                            | O que resolve                                                                                                                     | Backlog |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `audit/API-01-validacao-zod`    | 31 schemas Zod partilhados; os 32 endpoints com corpo validam antes do serviço (400 com `code` e lista de campos)                 | P2-01   |
| `audit/API-02-idempotencia`     | `Idempotency-Key` nos 9 endpoints de dinheiro: repetição → mesma resposta, em curso → 409, outro corpo → 422; o web envia a chave | P2-11   |
| `audit/API-03-versao-paginacao` | `/v1/…` (com alias sem prefixo para webhooks e apps instaladas); web e app usam `/v1`; `page.cursor` no catálogo                  | P2-11   |
| `audit/API-04-openapi`          | `openapi.yaml` gerado dos decoradores e dos schemas: 88 operações, 31 corpos; teste falha se o contrato divergir; Redocly válido  | P2-11   |

Verificação local: API 197 testes (com Postgres), web 16, shared 145;
typecheck, lint, dependency-cruiser e Prettier verdes; E2E 12/12 em duas
execuções seguidas (o site já chama `/v1` e passa pela validação Zod).

| Domínio      | Antes | Agora (código) | Com o dono | O que falta                                                           |
| ------------ | ----- | -------------- | ---------- | --------------------------------------------------------------------- |
| API          | 7     | **8,5**        | 8,5        | Respostas tipadas no OpenAPI; a app ainda não envia `Idempotency-Key` |
| Arquitectura | 8     | **8,5**        | 8,5        | Retirar o fluxo de encomendas legado                                  |
| Pagamentos   | 8     | **8,5**        | 9          | Reembolsos (P2-02); transferência bancária (decisão)                  |
| **Global**   | 7,7   | **7,8**        | **≈ 8,6**  |                                                                       |

Para 9 continuam a faltar: as tarefas do dono e do advogado, a app (Expo SDK
58, testes, build para as lojas) e os reembolsos.

## 4.ª ronda — engenharia restante (22/11/2026)

Seis ramos, empilhados depois de `audit/API-04-openapi`:

| Ramo                             | O que resolve                                                                                                                                      | Backlog             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `audit/MOB-02-app-lojas`         | Expo SDK 58 / RN 0.88 (0 vulnerabilidades altas), testes da app, `Idempotency-Key` na app, perfis EAS para as lojas, URL da API exigido em HTTPS   | P0-19, MOB          |
| `audit/ARQ-06-retirar-legado`    | Fluxo de encomendas legado removido (controladores, webhooks, workers); promoções pagas pela carteira                                              | P2-13               |
| `audit/PAY-02-reembolsos`        | Reembolso de carregamentos e pacotes pelo PawaPay (`/v2/refunds`), débito da carteira na mesma transacção, compensação se falhar, alarme e runbook | P2-02               |
| `audit/API-05-respostas-tipadas` | Respostas tipadas (Zod) no OpenAPI para as rotas principais; teste de contrato em tempo de compilação e de execução                                | P2-11               |
| `audit/INF-02-infra-producao`    | Produção com o serviço web, regra por host, NAT por AZ, endpoint S3, segredos escritos fora do plano (o plano já não lê segredos)                  | P0-08, P0-14, P2-12 |
| `audit/SEC-10-csp-nonce`         | CSP com nonce por pedido e `'strict-dynamic'` (sem `'unsafe-inline'` nos scripts), teste E2E que falha com violações                               | P2-07               |

Verificação local no último ramo: API 191 testes (1 ignorado), web 19,
shared 145, app 3; typecheck, lint, dependency-cruiser, Redocly e Prettier
verdes; `npm audit` da app sem altas/críticas; **E2E 17/17 em duas execuções
seguidas**. Lighthouse móvel (simulação 4G lenta) em
[evidências](evidencias/lighthouse-4a-ronda.md). **Terraform não foi
validado localmente**; o `validate` e o plano correm no CI do PR.

| Domínio        | 3.ª ronda | Agora (código) | Com o dono | O que falta                                                                         |
| -------------- | --------- | -------------- | ---------- | ----------------------------------------------------------------------------------- |
| Segurança      | 8         | **8,5**        | 9,5        | HTTPS/domínio, chaves root, WAF em "block", assinatura do webhook PawaPay (PAG-007) |
| Pagamentos     | 8,5       | **9**          | 9          | Transferência bancária (decisão)                                                    |
| Arquitectura   | 8,5       | **9**          | 9          | —                                                                                   |
| API            | 8,5       | **9**          | 9          | —                                                                                   |
| Dados          | 8         | **8**          | 9          | RPO/RTO e ensaio de restauro (P0-11)                                                |
| Performance    | 8         | **8**          | 9          | CDN para `/_next/static` (precisa do domínio e do workflow de deploy)               |
| Escalabilidade | 8         | **8,5**        | 9          | Aplicar o Terraform de produção                                                     |
| DevOps         | 7         | **8**          | 9          | Mover as propostas de CI/deploy, protecção do `main`                                |
| DevSecOps      | 7         | **7,5**        | 9          | Protecção do `main`, chaves root, propostas de CI                                   |
| Testes         | 8         | **8,5**        | 9          | Ligar o job E2E e o job mobile no CI (propostas prontas)                            |
| UX             | 8         | **8**          | 8,5        | Teste com 5 utilizadores reais em telemóvel                                         |
| Design e cores | 9         | **9**          | 9          | —                                                                                   |
| Acessibilidade | 8         | **8**          | 8,5        | TalkBack num Android real                                                           |
| Mobile         | 6         | **8**          | 8,5        | Build EAS e teste num Android real; submissão às lojas                              |
| Conformidade   | 7         | **7**          | 9          | Termos e privacidade revistos pelo advogado, parecer sobre apostas                  |
| **Global**     | 7,8       | **8,3**        | **≈ 9**    |                                                                                     |

**A engenharia que dependia só de código está feita.** O que separa 8,3 de 9
são as tarefas do dono e do advogado:

1. registar o domínio e seguir `runbooks/https.md`;
2. apagar as chaves root (IAM com MFA);
3. ligar a protecção do `main`;
4. mover `docs/audit/ci/*.proposta` para `.github/workflows/`;
5. pôr os segredos de produção como diz `runbooks/segredos.md`;
6. `OTP_DEV_ALLOWLIST` no staging, DSN do Sentry, subscrição dos alarmes;
7. decisões em `DECISOES.md`;
8. textos jurídicos e parecer.

Ficam para depois do lançamento: métricas de funil (P2-15), PWA offline
(P2-08), backoffice (P2-04) e `verify-full` no RDS (P2-06).
