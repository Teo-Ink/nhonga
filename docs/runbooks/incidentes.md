# Runbook — Resposta a incidentes

## Quem é avisado

Os alarmes CloudWatch (`modules/alarms`, OPS-02) publicam no tópico SNS
`nhonga-<env>-alarms`. Subscrever o email do responsável (`alarm_email`) e,
quando houver mais de uma pessoa, um canal de chat ou SMS.

## Severidades

| Nível | Exemplo                                                                         | Resposta                  |
| ----- | ------------------------------------------------------------------------------- | ------------------------- |
| SEV1  | site em baixo, pagamentos a creditar mal, fuga de dados                         | imediata, 24/7            |
| SEV2  | funcionalidade principal degradada (pesquisa lenta, login a falhar para alguns) | < 2 h em horário alargado |
| SEV3  | defeito com alternativa                                                         | próximo dia útil          |

## Primeiros 15 minutos

1. Confirmar: abrir o site, `GET /api/health` (web) e `GET /health/ready` (API).
2. Ver o alarme: qual métrica, desde quando.
3. Ver as últimas alterações: GitHub → Actions (deploys e `terraform apply` no
   `main`).
4. Logs:
   ```
   aws logs tail /ecs/nhonga-production-api --since 30m --region af-south-1
   aws logs tail /ecs/nhonga-production-web --since 30m --region af-south-1
   ```
5. Estado do ECS:
   ```
   aws ecs describe-services --cluster nhonga-production --services api --region af-south-1 \
     --query "services[].events[0:5].message"
   ```

## Acções comuns

- **Deploy mau**: o circuit breaker faz rollback sozinho. Se não fizer,
  disparar "Deploy API" com o SHA anterior, ou
  `aws ecs update-service --task-definition <revisão anterior>`.
- **BD sobrecarregada**: ver o alarme `rds-connections` e `rds-cpu`. Reduzir o
  `max_count` da API ou o `DB_POOL_MAX`. Procurar consultas lentas no
  Performance Insights.
- **SMS pumping** (alarme `otp-global-limit`): o limite já trava os envios.
  Rever os números nos logs (`otp_limited`) e baixar `OTP_MAX_GLOBAL_HOUR` se
  for preciso.
- **Pagamentos em "review"**: não creditar à mão sem confirmar no painel do
  gateway; registar a decisão.
- **Fuga de segredo**: rodar o segredo (Secrets Manager e o painel do
  gateway), fazer um novo deploy e rever o histórico com gitleaks.

## Depois

Post-mortem sem culpas em 5 dias úteis: cronologia, impacto, causa, o que
funcionou, acções com dono e data.
