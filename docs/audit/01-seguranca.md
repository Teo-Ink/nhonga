# 01 — Segurança aplicacional

**Pontuação: 5/10** antes das correcções da Parte 1; **7/10** com os branches
`audit/*` juntos. Ainda faltam HTTPS, staging protegido, endpoints admin
fechados e publicação só com sessão.

## Resumo

A base é sólida: códigos OTP com hash scrypt, sessão opaca em cookie `httpOnly`
e `SameSite=Lax`, verificação de dono nos anúncios e nas conversas, helmet na
API, segredos no Secrets Manager e deploy por OIDC. Os problemas graves estavam
nas corridas do OTP, na falta de limites persistentes e de cabeçalhos, no
staging aberto e em endpoints "admin-lite" públicos. Também é possível publicar
anúncios sem conta.

## Achados

### SEC-001 — Limite de tentativas do OTP contornável em paralelo

- Severidade: Crítica · Bloqueia go-live: Sim · **Estado: corrigido em `audit/SEC-01-otp-atomico`**
- Evidência: `apps/api/src/modules/auth/auth.service.ts` (`verifyOtp`, versão
  `14e952c`), que lia `attempts`, comparava e gravava `attempts + 1`. O teste
  `auth.service.db.test.ts` reproduz a falha no código antigo: 20 tentativas
  erradas em paralelo foram todas avaliadas, e dois códigos certos criaram duas
  sessões.
- Impacto: força bruta do código de 6 dígitos e tomada de contas.
- Correcção: a tentativa é reclamada com um `UPDATE` condicional antes de
  comparar o código, e o consumo é atómico.
- Esforço: S

### SEC-002 — Envio de SMS sem limites persistentes (SMS pumping)

- Severidade: Alta · Bloqueia: Sim · **Estado: corrigido em `audit/SEC-02-limites-otp`**
- Evidência: só havia 5 pedidos por número em 10 minutos e um limite por IP em
  memória na BFF (`apps/web/lib/rate-limit.ts`).
- Correcção: limites contados no Postgres: intervalo de 60 s, tecto diário por
  número e tecto global por hora. O tecto global regista um alerta que tem
  alarme (OPS-02). Os números não moçambicanos já eram recusados por
  `normaliseMzMsisdn`.
- Esforço: S

### SEC-003 — Faltam cabeçalhos de segurança no web

- Severidade: Alta · Bloqueia: Sim · **Estado: corrigido em `audit/SEC-03-cabecalhos-web`**
- Evidência: `evidencias/staging-22-11-2026.md` mostra `x-powered-by: Next.js`
  e nenhuma CSP, HSTS ou X-Frame-Options.
- Correcção: CSP sem scripts de terceiros, nosniff, `X-Frame-Options: DENY`,
  `Referrer-Policy` e `Permissions-Policy`. HSTS só sobre HTTPS. Verificado no
  Chrome headless sem violações de CSP.
- Pendente (Baixa): `script-src` ainda precisa de `'unsafe-inline'`; passar a
  nonces (SEC-013).

### SEC-004 — Rate limiting em memória, por instância **[DECISÃO]**

- Severidade: Alta · Bloqueia: Sim
- Evidência: `apps/api/src/common/rate-limit.ts` e `apps/web/lib/rate-limit.ts`
  guardam contadores num `Map`; a API escala até 4 tarefas e o web até 3.
- Mitigação feita: o OTP passou a ter limites persistentes (SEC-002).
- Opções em `DECISOES.md`. Recomendado: AWS WAF rate-based no ALB para o
  limite por IP, e tabela Postgres para o assistente de IA.
- Esforço: M

### SEC-005 — O Terraform deixava criar produção sem HTTPS

- Severidade: Alta · **Estado: corrigido em `audit/SEC-05-https-obrigatorio`**
- Evidência: o bloco `check "https_required_in_production"` só gera um aviso.
- Correcção: `validation` em `certificate_arn`, que falha `plan` e `apply`.

### SEC-006 — Staging público: login de qualquer número e pagamentos simulados **[DECISÃO]**

- Severidade: Alta · Bloqueia: Sim (go-live público)
- Evidência: `SMS_MODE=mock` devolve `devCode`. Entrei no staging com
  `+258841234567` sem ter esse número. A API está pública em `:8080`. Em modo
  mock, `POST /ads` reserva uma campanha **e publica-a de imediato sem
  pagamento real** (`ads.service.ts:172-182`), por isso qualquer pessoa pode pôr
  uma imagem e um link na home do staging.
- Opções em `DECISOES.md`.

### SEC-007 — Corpo JSON de 12 MB em todas as rotas e uploads sem validação real

- Severidade: Alta · **Estado: corrigido em `audit/SEC-07-limites-upload`**
- Evidência: `main.ts:20`; `media.service.ts` só verificava o tipo declarado
  no data URL e guardava os bytes tal como vinham (com EXIF/GPS).
- Correcção: 100 KB por defeito e 12 MB só nas 3 rotas de fotos (413
  verificado). As imagens passam por magic bytes, limite de megapíxeis,
  rotação, redimensionamento e recodificação em WebP, sem metadados.

### SEC-008 — Sem tecto de custo para a IA

- Severidade: Média · **Estado: corrigido em `audit/CONT-02-guardas-producao`**
- A produção recusa arrancar com `ASSISTANT_MONTHLY_TOKEN_CAP=0`. Falta o
  alarme de custo (AWS Budgets) do lado da conta.

### SEC-009 — Endpoints "admin-lite" públicos

- Severidade: Alta · Bloqueia: Sim
- Evidência: `ads.controller.ts:56` (`GET /ads/admin`) e
  `promotions.controller.ts:38` (`GET /promotions/admin/active`) não têm guarda.
  No staging, `:8080/ads/admin` devolve todas as campanhas com preço,
  impressões e cliques (`evidencias/staging-22-11-2026.md`).
- Impacto: fuga de dados comerciais; superfície para enumerar.
- Recomendação: remover das rotas públicas ou exigir papel `admin` (tabela de
  papéis + guarda Nest), servidos apenas a partir de uma app de backoffice.
- Esforço: S (remover) / M (papéis)

### SEC-010 — Publicação de anúncios sem sessão

- Severidade: Alta · Bloqueia: Sim
- Evidência: `catalog.service.ts:80-123`. Sem token, o anúncio vai para a loja
  partilhada "Anúncios da Comunidade" (`ensureCommunityVendor`).
- Impacto: spam e burlas sem rasto. A moderação fica sem a quem bloquear.
- Recomendação: exigir sessão em `POST /catalog/products` (e no BFF). Limitar
  anúncios por utilizador e por dia, e manter o formulário de publicação a
  pedir login no fim (como a OLX).
- Esforço: S

### SEC-011 — Sem validação de input por schema

- Severidade: Média · Domínio: Arquitectura (ARQ-001)
- Evidência: não há Zod nem `class-validator` nos controladores. Os campos são
  lidos com `typeof` (ex.: `ads.controller.ts`, `str(...)`). `main.ts:62`
  admite que a validação global ainda não está ligada.

### SEC-012 — Sem TLS

- Severidade: Crítica para produção · Bloqueia: Sim · **[tarefa do dono: OPS-01]**
- Evidência: a porta 443 não responde, e o cookie de sessão vai sem `Secure` no
  staging (`SESSION_COOKIE_INSECURE=1`). O runbook de activação está em
  `docs/runbooks/https.md`.

### SEC-013 — CSP com `'unsafe-inline'` em scripts

- Severidade: Baixa. Passar a nonces com middleware e páginas dinâmicas.

### SEC-014 — Código OTP nos logs em modo mock

- Severidade: Informativa. `auth.service.ts:108` regista o código, mas só fora
  de produção (o modo mock é recusado em produção).

### SEC-015 — Não é possível bloquear utilizadores

- Severidade: Média. É obrigatório para conteúdo gerado por utilizadores nas
  lojas de apps (ver `14-mobile.md`). Ver `evidencias/autorizacao-moderacao.txt`.

### SEC-016 — RDS com `sslmode=require` sem verificar o certificado

- Severidade: Baixa. Passar a `verify-full` com o CA bundle da AWS na imagem
  (P2 SEC-10).

### SEC-017 — Não é possível eliminar a conta

- Severidade: Alta · Bloqueia: Sim (lojas de apps e protecção de dados)
- Evidência: não há endpoint nem ecrã (`evidencias/seguranca-grep.txt`).
- Recomendação: `DELETE /auth/me` que anonimiza o utilizador, desactiva os
  anúncios, apaga os tokens e guarda os registos financeiros pelo prazo legal.
  Ecrã na web e na app.
- Esforço: M

## O que está bem

- OTP com hash scrypt e comparação em tempo constante; 5 tentativas; 10 minutos.
- Sessão opaca (hash na BD), cookie `httpOnly`, `SameSite=Lax`, 7 dias.
- Verificação de dono em editar/apagar anúncio (`catalog.service.ts:394,423,531`)
  e de participante nas conversas (`messaging.service.ts`).
- Sem SQL cru: só o builder do Drizzle. O único `dangerouslySetInnerHTML` é um
  script fixo do layout.
- Os telefones só aparecem se o vendedor os quiser mostrar (`showPhone`,
  `showWhatsapp`).
- Webhooks de pagamento: o estado é sempre lido de novo no gateway; PaySuite
  com HMAC.
- CI com gitleaks (CLI verificado por checksum), `pnpm audit` e Trivy IaC.
