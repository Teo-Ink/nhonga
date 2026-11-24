# 08 — DevOps

**Pontuação: 6/10**

## Resumo

Tudo em Terraform:

- estado remoto em S3 com lock;
- OIDC sem chaves;
- staging aplicado automaticamente;
- produção com aprovação;
- deploy rolling com rollback automático;
- migrações no arranque com lock.

Faltam:

- alarmes (feito em OPS-02);
- error tracking;
- logs estruturados;
- runbooks (feitos 3);
- algumas arestas da pipeline.

## Achados

### DEV-001 — Sem alarmes

- Alta · **Estado: corrigido em `audit/OPS-02-alarmes`** (SNS e 13 alarmes; ver
  `09-devsecops.md` para a aplicação). Subscrever `alarm_email`.

### DEV-002 — Sem error tracking

- Alta · Esforço: M. Não há Sentry nem equivalente na API, na web ou na app.
  Recomendação: Sentry, plano Team ou self-hosted, com `release` igual ao SHA
  do deploy.

### DEV-003 — Logs de texto sem request-id

- Média · Esforço: S. O `Logger` do Nest escreve texto. Recomendação: pino em
  JSON, com `x-request-id` gerado no ALB e propagado pela BFF.

### DEV-004 — O deploy falha quando a imagem já existe

- Média · Esforço: S
- Evidência: o ECR é `IMMUTABLE` e `deploy.yml` faz `docker push` sem
  verificar. Dois deploys do mesmo SHA (automático e manual) fizeram o segundo
  falhar em 22/11/2026.
- Recomendação: `aws ecr describe-images` antes do push e saltar se já
  existir.

### DEV-005 — O plano de staging falha em PRs desde que o staging existe

- Média · Esforço: S
- Evidência: o papel `nhonga-gha-terraform-plan` tem
  `secretsmanager:GetSecretValue` negado de propósito, e o refresh de
  `aws_secretsmanager_secret_version` precisa dele. O PR #5 foi junto com este
  check vermelho.
- Opções:
  - permitir a leitura só dos segredos `nhonga-staging/*` ao papel de plan;
  - ou gerir a versão do segredo fora do Terraform (`ignore_changes`) e criá-lo
    com `aws secretsmanager put-secret-value` no bootstrap.

### DEV-006 — "Plan (production)" vai falhar até haver certificado

- Informativa: efeito intencional de SEC-005. O job pode ficar condicionado a
  `vars.PRODUCTION_ENABLED == 'true'` para não poluir os PRs.

### DEV-007 — Migrações só para a frente

- Baixa. Não há "down". Em incidente, o rollback de código precisa de
  migrações compatíveis para trás (expand/contract). Documentar a regra.

### DEV-008 — Runbooks

- **Feito**:
  - `docs/runbooks/https.md`;
  - `docs/runbooks/backups-restauro.md`;
  - `docs/runbooks/incidentes.md`.

## O que está bem

- CI completo e rápido: formatação, lint, tipos, limites, build, testes,
  OpenAPI, segredos, auditoria de dependências, Terraform e Trivy.
- Separação staging/produção por estado e por papéis IAM; produção com
  aprovador.
- ECS com `deployment_circuit_breaker { rollback = true }`.
