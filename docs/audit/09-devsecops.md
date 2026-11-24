# 09 — DevSecOps

**Pontuação: 6/10**

## Achados

### DSO-001 — Chaves de acesso da conta root em uso

- Severidade: Crítica · Bloqueia: Sim
- Evidência: `aws sts get-caller-identity` no computador do dono devolveu
  `arn:aws:iam::526156223765:root` (22/11/2026). As mesmas chaves serviram para
  o bootstrap.
- Recomendação:
  - criar um utilizador IAM (ou IAM Identity Center) com MFA para o dia a dia;
  - apagar as chaves root;
  - activar MFA no root.
- Esforço: S (tarefa do dono)

### DSO-002 — Sem protecção do branch `main`

- Severidade: Alta · Bloqueia: Sim
- Evidência: o PR #5 foi junto com um check vermelho e não houve bloqueio.
  Também não há revisão obrigatória.
- Recomendação: ruleset no `main`:
  - checks obrigatórios (Format, Unit tests, Secret scan, Terraform fmt, Trivy);
  - sem push directo;
  - histórico linear;
  - 1 aprovação quando houver mais de uma pessoa.
- Esforço: S

### DSO-003 — Imagens Docker sem scan

- Média · Esforço: S. O ECR tem `scan_on_push = true` (scan básico), mas o CI
  não falha com vulnerabilidades. Adicionar `trivy image` no `deploy.yml` antes
  do push, a falhar em HIGH/CRITICAL.

### DSO-004 — Alertas do GitHub vs `pnpm audit`

- Média. O GitHub indicou 39 vulnerabilidades no ramo por defeito (1 crítica,
  11 altas), enquanto `pnpm audit --audit-level high` passa (6 moderadas, 3
  baixas). Hipóteses:
  - os alertas incluem `apps/mobile/package-lock.json` (npm, fora do
    workspace);
  - ou ainda não foram reavaliados depois das overrides.
- A confirmar na página Security → Dependabot. Adicionar
  `.github/dependabot.yml` para `npm` (raiz e `apps/mobile`) e `github-actions`.

### DSO-005 — Papel de deploy com permissões largas

- Média
- Evidência: `infra/terraform/bootstrap/deploy-policy.tf` dá
  `ec2:*, rds:*, s3:*, kms:*…` em `*`, com um deny para a escalada ao nível da
  conta.
- Aceitável no arranque. Reduzir quando a infra estabilizar, por exemplo com
  restrições por tag `Project=nhonga`.

### DSO-006 — WAF, GuardDuty, CloudTrail e AWS Config

- Média · **Não verificável** sem acesso à conta. Recomendação:
  - CloudTrail multi-região num bucket com bloqueio;
  - GuardDuty;
  - AWS Config com regras básicas;
  - WAF gerido no ALB de produção (P2 SEC-09; também resolve parte de SEC-004).

### DSO-007 — SAST

- Informativa. O CodeQL já corre (configuração por defeito do GitHub, visto
  nos checks dos PRs). Avaliar o Semgrep para regras específicas de NestJS e
  Next.

## O que está bem

- gitleaks em todos os PRs, com CLI verificado por checksum.
- Trivy IaC; achados médios e baixos documentados com `#trivy:ignore` e
  justificação.
- OIDC com o subject imutável do GitHub (`repo:Teo-Ink@291932914/nhonga@1373752316`).
- Segredos só no Secrets Manager; plan sem leitura de segredos.
- Security groups em três camadas (ALB → tarefas → RDS), sem egress aberto.
