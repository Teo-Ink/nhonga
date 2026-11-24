# 05 — Armazenamento de dados

**Pontuação: 6/10**

## Achados

### DAT-001 — A pesquisa de texto carrega todos os anúncios activos para a memória

- Severidade: Alta (escala) · Bloqueia: Não no arranque · Esforço: M
- Evidência: `catalog.service.ts:742-830`. Com uma consulta de texto, o filtro
  de categoria não vai para o SQL (`if (filters.categorySlug && !hasQuery)`), e
  a pontuação (`scoreListing`) corre em JavaScript sobre todas as linhas
  devolvidas. Não há `pg_trgm`, `unaccent` nem `tsvector`
  (`evidencias/dados-pesquisa.txt`).
- Impacto: com dezenas de milhares de anúncios, cada pesquisa lê e transfere a
  tabela inteira; latência e CPU crescem de forma linear.
- Recomendação: coluna `tsvector` com dicionário `portuguese` + `unaccent`,
  índice GIN e `pg_trgm` para tolerar erros ortográficos. Paginar no SQL. Mais
  tarde, OpenSearch se a relevância o exigir.

### DAT-002 — Imagens em base64 dentro do Postgres

- Severidade: Alta · ver ARQ-005.

### DAT-003 — O anúncio não tem localização própria

- Severidade: Média · Esforço: M
- Evidência: a localização vem do distrito do vendedor
  (`catalog.service.ts`, `leftJoin(district, vendor.districtId)`). Causou as
  incoerências do seed (T3 em Sommerschield mostrado na Matola), já corrigidas
  em `audit/CONT-02-guardas-producao`.
- Recomendação: `product.district_id` (e bairro opcional), escolhido ao
  publicar, com o do vendedor como valor por defeito.

### DAT-004 — Backups configurados, restauro nunca testado

- Severidade: Alta · Bloqueia: Sim (produção) **[DECISÃO RPO/RTO]**
- Evidência: `modules/database/main.tf`:
  - `backup_retention_period = 35`;
  - PITR;
  - `storage_encrypted = true`;
  - `deletion_protection = true`;
  - snapshot final;
  - Multi-AZ em produção.
- Falta: um teste de restauro e o RPO/RTO acordados. O runbook está em
  `docs/runbooks/backups-restauro.md`.

### DAT-005 — Ciclo de vida dos dados

- Severidade: Média
- Os anúncios não expiram, as fotos de anúncios apagados ficam no
  `media_asset`, e os `otp_challenge` e `checkout_intent` antigos não são
  limpos. Recomendação: expirar anúncios aos 60 dias com aviso, uma tarefa de
  limpeza diária e retenção definida por tabela.

### DAT-006 — Protecção de dados e eliminação de conta

- Severidade: Alta · ver SEC-017. Dados pessoais recolhidos: telefone, nome,
  email opcional, mensagens, localização do vendedor, IP no `otp_challenge`
  (campo existe). A política de privacidade ainda tem marcadores
  (`app/privacidade/page.tsx`). Precisa de validação jurídica face à Lei
  n.º 3/2017 (Transacções Electrónicas). Usar o RGPD como referência de boas
  práticas.

### DAT-007 — Seed com dados incoerentes

- Severidade: Baixa · **Estado: corrigido** (novas BDs). O staging mantém as
  linhas antigas até ser semeado de novo.

## O que está bem

- RDS em subnets privadas, acessível só a partir do security group das
  tarefas.
- Cifra em repouso e em trânsito (`sslmode=require`; `verify-full` pendente).
- Migrações versionadas, aplicadas no arranque com advisory lock; manuais
  registadas em `_manual_migration`.
- Índices nos acessos principais: `product_vendor_status_idx`,
  `product_category_active_idx`, GIN em `attributes`, `otp_challenge` (+0019
  em SEC-02).
- 81 restrições `CHECK` no schema.
