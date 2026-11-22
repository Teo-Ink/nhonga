# Runbook — Backups e restauro da base de dados (OPS-03)

Configuração (Terraform, `modules/database`):

- backups automáticos diários, retenção de 35 dias;
- PITR com granularidade de ~5 minutos;
- cifra em repouso;
- `deletion_protection`;
- snapshot final ao apagar;
- Multi-AZ em produção.

Objectivos propostos (por aprovar, `docs/audit/DECISOES.md`): **RPO 15 min,
RTO 4 h**.

## Ensaio trimestral (no staging)

1. Escolher um instante T (por exemplo, há 1 hora).
2. RDS → `nhonga-staging` → Actions → **Restore to point in time** → T. Nome:
   `nhonga-staging-restore-AAAAMMDD`, mesma subnet group e security group,
   sem acesso público.
3. Esperar pelo estado `Available` e registar quanto tempo demorou (conta para
   o RTO).
4. Validar a partir de uma tarefa ECS (ECS Exec) ou de um bastion temporário:
   ```
   psql "postgresql://…@nhonga-staging-restore-…/nhonga?sslmode=require" \
     -c "select count(*) from product; select max(created_at) from otp_challenge;"
   ```
   `max(created_at)` deve estar perto de T (é o RPO real).
5. Apagar a instância restaurada (desactivar antes a deletion protection, se
   estiver activa) e registar o resultado em `docs/runbooks/registo-ensaios.md`.

## Restauro em produção (incidente)

1. Declarar o incidente (`incidentes.md`) e pôr a API em manutenção (escalar o
   serviço `api` para 0 ou activar uma página de manutenção no ALB).
2. Restaurar para um instante T, antes do erro, numa **nova** instância.
3. Validar os dados (passo 4 acima).
4. Trocar a `DATABASE_URL` no Secrets Manager para a nova instância (ou
   renomear as instâncias: a antiga → `-old`, a nova → nome original, para
   manter o endpoint).
5. Reiniciar o serviço `api` (as migrações correm no arranque, com lock).
6. Ficar com a instância antiga 7 dias antes de a apagar.
7. Escrever o post-mortem.

## Fora do RDS

- Imagens: estão na BD (`media_asset`) e entram nos backups. Quando passarem
  para o S3 (ARQ-005), activar versionamento e replicação.
- Estado do Terraform: S3 com versionamento (bootstrap).
