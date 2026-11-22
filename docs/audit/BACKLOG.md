# Backlog da auditoria de pré-produção (22/11/2026)

> **2.ª ronda:** as tarefas marcadas ✅ com o nome do ramo entre parênteses
> estão feitas nos ramos `audit/*` novos (ver
> [`16-reavaliacao-rumo-a-9.md`](16-reavaliacao-rumo-a-9.md)).

Base: `14e952c`. Estados:

- ✅ **feito em branch** (`audit/*`, à espera de revisão e merge);
- 🟡 **parcial**;
- 🔶 **[DECISÃO]**, opções em `DECISOES.md`;
- 👤 **tarefa do dono**;
- ⬜ **por fazer**.

Esforço: S < ½ dia · M 1–2 dias · L 3–5 dias · XL > 1 semana.

## Estado das tarefas da Parte 1

| ID      | Título                                            | Estado                  | Branch / onde                                                    |
| ------- | ------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| SEC-01  | OTP atómico (tentativas e consumo)                | ✅                      | `audit/SEC-01-otp-atomico`                                       |
| SEC-02  | Limites de envio de OTP persistentes              | ✅                      | `audit/SEC-02-limites-otp` (sobre SEC-01)                        |
| SEC-03  | Cabeçalhos de segurança e CSP no web              | ✅                      | `audit/SEC-03-cabecalhos-web`                                    |
| SEC-04  | Rate limit partilhado                             | 🔶                      | `DECISOES.md` (OTP já persistente)                               |
| SEC-05  | Terraform recusa produção sem HTTPS               | ✅                      | `audit/SEC-05-https-obrigatorio`                                 |
| SEC-06  | Restringir o staging                              | 🔶                      | `DECISOES.md`                                                    |
| OPS-01  | HTTPS e domínio                                   | 👤 + ✅ runbook         | `docs/runbooks/https.md`                                         |
| WEB-01  | BFF sem 500 (timeout, 503, fallback, corpo vazio) | ✅                      | `audit/WEB-01-bff-robusto`                                       |
| CONT-01 | Promessas de marketplace atrás de flag            | ✅ + 🔶 modelo          | `audit/CONT-01-promessas-flag` (sobre WEB-01)                    |
| CONT-02 | Produção recusa demo; seed corrigido              | ✅                      | `audit/CONT-02-guardas-producao`                                 |
| PERF-01 | Vídeo do hero (6,1 → 0,7 MB, só desktop)          | ✅                      | `audit/PERF-01-video-hero`                                       |
| WEB-02  | robots, sitemap, Open Graph, JSON-LD              | ✅                      | `audit/WEB-02-seo-partilha`                                      |
| WEB-03  | Fontes locais (build sem rede)                    | ✅                      | `audit/WEB-03-fontes-locais`                                     |
| TEST-01 | Testes no web                                     | 🟡                      | Vitest e testes de helpers em WEB-01 e CONT-01; falta Playwright |
| TEST-02 | Integração com Postgres (checkout)                | ✅ (+ CI 🟡)            | `audit/TEST-02-integracao-checkout`; job em `ci/ci.yml.proposta` |
| MOB-01  | App mobile no CI                                  | 🟡                      | `ci/ci.yml.proposta` (mover à mão)                               |
| SEC-07  | Limites de corpo e validação de imagens           | ✅                      | `audit/SEC-07-limites-upload`                                    |
| SEC-08  | Tecto de custo da IA em produção                  | ✅ (alarme de custo 👤) | `audit/CONT-02-guardas-producao`                                 |
| OPS-02  | Alarmes CloudWatch + SNS                          | ✅                      | `audit/OPS-02-alarmes`                                           |
| OPS-03  | Backups e restauro                                | ✅ runbook + 🔶 RPO/RTO | `docs/runbooks/backups-restauro.md`                              |

Não reproduzido: SEC-02, "bloquear prefixos não moçambicanos" (já era feito
por `normaliseMzMsisdn`); ACC-01, "4 imagens sem alt" (0/37 na visita de
22/11).

## P0 — Bloqueadores de go-live

### Épico A — Hardening de autenticação e abuso

| ID    | Tarefa                                                                   | Origem           | Área          | Esforço | Critério de aceitação                                                                 | Dep.        |
| ----- | ------------------------------------------------------------------------ | ---------------- | ------------- | ------- | ------------------------------------------------------------------------------------- | ----------- |
| P0-01 | Merge de SEC-01 e SEC-02                                                 | SEC-001/002      | backend       | S       | CI verde com Postgres; os testes de concorrência passam                               | CI-Postgres |
| P0-02 | ✅ Exigir sessão para publicar; limite de anúncios por dia (SEC-09)      | SEC-010          | backend+web   | S       | `POST /catalog/products` sem token → 401; o formulário pede login no fim              | —           |
| P0-03 | ✅ Fechar `/ads/admin` e `/promotions/admin/active` (SEC-09)             | SEC-009          | backend       | S       | 401/404 sem sessão admin; teste                                                       | —           |
| P0-04 | ✅ Rate limit partilhado (decisão SEC-04) (SEC-09 (Postgres))            | SEC-004          | infra+backend | M       | o limite mantém-se com 2 instâncias; teste de integração                              | decisão     |
| P0-05 | ✅ Restringir o staging (decisão SEC-06) (SEC-09 (falta pôr os números)) | SEC-006          | infra+backend | S       | um anónimo não obtém `devCode` fora da allowlist                                      | decisão     |
| P0-06 | ✅ Eliminação de conta (API, web, app) (CMP-01)                          | SEC-017, MOB-004 | full-stack    | M       | `DELETE /auth/me` anonimiza, desactiva anúncios e revoga sessões; ecrã nos 3 clientes | —           |

### Épico B — Plataforma e operação

| ID    | Tarefa                                                           | Origem          | Área       | Esforço | Critério                                                      | Dep.       |
| ----- | ---------------------------------------------------------------- | --------------- | ---------- | ------- | ------------------------------------------------------------- | ---------- |
| P0-07 | Domínio, ACM, HTTPS, regras por host                             | OPS-01, SEC-012 | infra      | M       | `curl -I https://…` com HSTS; cookie `Secure`; sem porta 8080 | 👤 domínio |
| P0-08 | Serviço web em produção                                          | ESC-005         | infra      | S       | `envs/production` com módulo `web` e regra por host           | P0-07      |
| P0-09 | Protecção do branch `main`                                       | DSO-002         | devops     | S       | merge bloqueado com check vermelho                            | —          |
| P0-10 | Apagar as chaves root; IAM com MFA                               | DSO-001         | conta 👤   | S       | `sts get-caller-identity` não devolve `:root`                 | —          |
| P0-11 | Ensaio de restauro e RPO/RTO aprovados                           | DAT-004         | infra      | S       | registo do ensaio com tempos                                  | decisão    |
| P0-12 | Merge de OPS-02 e subscrição do email                            | DEV-001         | infra      | S       | alarme de teste chega ao email                                | —          |
| P0-13 | ✅ Error tracking (Sentry) API, web e app (OPS-04 (falta o DSN)) | DEV-002         | full-stack | M       | erro forçado aparece com o SHA do release                     | —          |
| P0-14 | Plano de staging sem leitura de segredos a falhar                | DEV-005         | infra      | S       | "Plan (staging)" verde nos PRs                                | —          |

### Épico C — Conteúdo, legal e lojas

| ID    | Tarefa                                                                                         | Origem           | Área          | Esforço | Critério                                               | Dep.    |
| ----- | ---------------------------------------------------------------------------------------------- | ---------------- | ------------- | ------- | ------------------------------------------------------ | ------- |
| P0-15 | Decidir classificados vs marketplace                                                           | CMP-001          | negócio 👤    | —       | decisão registada em `DECISIONS.md`                    | —       |
| P0-16 | Termos, privacidade, cookies e regras de publicação                                            | CMP-003          | legal 👤      | M       | textos sem marcadores, revistos pelo advogado          | jurista |
| P0-17 | ✅ Publicidade de apostas: regras e filtro 18+ (CMP-01 (recusadas; falta parecer))             | CMP-002          | legal+backend | M       | parecer + flag que esconde a categoria                 | jurista |
| P0-18 | ✅ Denunciar e bloquear na app e na web (CMP-01)                                               | MOB-005, SEC-015 | full-stack    | M       | denúncia na app; bloqueio esconde mensagens e anúncios | —       |
| P0-19 | ✅ Identificadores da app e API em HTTPS no EAS (CMP-01 (ids + HTTPS; URL depende do domínio)) | MOB-002/003      | mobile        | S       | build `preview` liga à API em HTTPS                    | P0-07   |

**Esforço P0 (sem decisões/jurídico):** cerca de 14–20 dias-pessoa.

## P1 — Primeiras 2 semanas

### Épico D — Pesquisa e dados

| ID    | Tarefa                                                             | Origem   | Esforço | Critério                                                               |
| ----- | ------------------------------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------- |
| P1-01 | ✅ Pesquisa na BD: `tsvector` pt + `unaccent` + `pg_trgm` (DAT-01) | DAT-001  | M       | p95 < 300 ms com 50 000 anúncios; teste de relevância com 20 consultas |
| P1-02 | Localização própria do anúncio                                     | DAT-003  | M       | campo na publicação; filtro por distrito usa o anúncio                 |
| P1-03 | ✅ Fotos para S3 + CloudFront (ARQ-05)                             | ARQ-005  | M       | `media_asset` passa a guardar a chave; migração dos existentes         |
| P1-04 | ✅ CDN para estáticos e media (ARQ-05 (fotos; estáticos 🔶))       | PERF-002 | M       | `_next/static` servido com HIT                                         |

### Épico E — Qualidade

| ID    | Tarefa                                          | Origem                    | Esforço | Critério                                          |
| ----- | ----------------------------------------------- | ------------------------- | ------- | ------------------------------------------------- |
| P1-05 | ✅ Playwright E2E (7 fluxos, 360 px) (TEST-01)  | TST-003                   | L       | job E2E verde contra `docker compose`             |
| P1-06 | Mover as propostas de CI e deploy               | TST-004, DEV-004, DSO-003 | S       | job `mobile` e Postgres no CI; deploy idempotente |
| P1-07 | ✅ Dependabot e revisão dos 39 alertas (OPS-04) | DSO-004                   | S       | `dependabot.yml`; alertas triados                 |
| P1-08 | ✅ Logs JSON com request-id (OPS-04)            | DEV-003                   | S       | `x-request-id` presente na API e na BFF           |
| P1-09 | ✅ Alarme para pagamentos em "review" (OPS-04)  | PAG-002                   | S       | filtro de métrica + alarme                        |
| P1-10 | ✅ Registo de tratamento "você" (UX-02)         | UX-002                    | S       | nenhuma ocorrência de "Inicia sessão/Paga/Tens"   |
| P1-11 | ✅ Rascunho offline do anúncio (SEC-09)         | UX-004                    | M       | recarregar a página mantém texto e fotos          |

## P2 — Primeiro trimestre

| ID    | Tarefa                                                                         | Origem      | Esforço |
| ----- | ------------------------------------------------------------------------------ | ----------- | ------- |
| P2-01 | Validação Zod centralizada                                                     | ARQ-001     | L       |
| P2-02 | Reembolsos e estornos                                                          | PAG-003     | M       |
| P2-03 | Transferência bancária (decisão)                                               | PAG-005     | M       |
| P2-04 | Backoffice mínimo (moderação, revisão, publicidade)                            | ARQ-003     | L       |
| P2-05 | ✅ WAF gerido, GuardDuty, CloudTrail, Config (DSO-06)                          | DSO-006     | M       |
| P2-06 | RDS `verify-full`                                                              | SEC-016     | S       |
| P2-07 | CSP com nonces                                                                 | SEC-013     | M       |
| P2-08 | Service worker e PWA offline                                                   | PERF-004    | M       |
| P2-09 | ✅ Auditoria de acessibilidade com axe e TalkBack (TEST-01 (axe; TalkBack 🔶)) | ACC-003/005 | M       |
| P2-10 | ✅ Expiração de anúncios e limpeza de dados (DAT-01)                           | DAT-005     | S       |
| P2-11 | Versionar a API (`/v1`) e Idempotency-Key                                      | API-003/004 | M       |
| P2-12 | NAT por AZ ou VPC endpoints                                                    | ESC-002     | S       |
| P2-13 | Remover ou isolar o fluxo de encomendas legado                                 | PAG-006     | M       |
| P2-14 | ✅ README e documentação de arquitectura (ARQ-02)                              | ARQ-002     | S       |
| P2-15 | Métricas de produto e funil                                                    | CMP-005     | M       |

## P3 — Melhorias contínuas

Semgrep; reduzir o papel de deploy por tags; tarefas periódicas com
EventBridge; RDS Proxy quando houver mais de 8 tarefas; AAA de contraste nos
ecrãs críticos; tempo de resposta do vendedor; idiomas locais.

## Sprints sugeridos (1 semana)

1. **S1**:
   - merge de SEC-01/02/03/05/07, WEB-01/03, CONT-01/02, PERF-01, WEB-02,
     TEST-02 e OPS-02;
   - P0-02, P0-03, P0-09, P0-10, P0-14;
   - P1-06.
2. **S2**: P0-04, P0-05, P0-06, P0-12, P0-13, P0-18; decisões (SEC-04, SEC-06,
   RPO/RTO, modelo).
3. **S3**: P0-07, P0-08, P0-11, P0-19 (com o domínio), P1-01, P1-05.
4. **S4**: P0-16, P0-17 (com o jurista), P1-02, P1-03, P1-04, P1-08 a P1-11 →
   **go-live**.

## Issues no GitHub

Não foram criadas. A Parte 2 pede confirmação antes de criar issues. Com essa
confirmação, dá para criar uma issue por tarefa P0/P1 com as etiquetas
`prioridade:P0`, `area:*`, `severidade:*` e o milestone "Go-Live".
