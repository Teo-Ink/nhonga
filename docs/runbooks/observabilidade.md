# Observabilidade — logs, request id, erros e alarmes

## Logs

A API e o web escrevem **uma linha JSON por evento**, com `ts`, `level`
(`ERROR`, `WARN`, `INFO`…), `context`, `msg` e, quando existe, `requestId`.
Cada pedido HTTP à API gera uma linha `msg: "request"` com método, caminho
(sem query string, ids trocados por `:id`), estado e duração em ms.

Nunca vão para os logs: query strings, corpos de pedidos, códigos de login
(antes iam, em modo SMS simulado) nem números completos.

### Seguir um erro de um utilizador

1. O erro 5xx da API devolve `requestId` no corpo e no cabeçalho
   `x-request-id`. O BFF do web envia um `x-request-id` (`web-…`) em cada
   chamada.
2. CloudWatch Logs Insights, grupo `/ecs/nhonga-<env>-api`:

   ```
   fields ts, level, context, msg, status, ms
   | filter requestId = "web-…"
   | sort ts asc
   ```

3. Erros da última hora por contexto:

   ```
   fields context, msg
   | filter level = "ERROR"
   | stats count() by context
   ```

## Error tracking (Sentry)

Desligado até existir um DSN. Para ligar:

1. Criar o projecto Node no Sentry (plano gratuito chega para começar).
2. Pôr o DSN no segredo `nhonga-<env>/SENTRY_DSN` (o repositório é público,
   por isso o DSN não fica no código):
   `aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/SENTRY_DSN --secret-string "<DSN>"`
   e reiniciar o serviço: `aws ecs update-service --region af-south-1 --cluster nhonga-<env> --service api --force-new-deployment`.
3. Depois do deploy, a linha de arranque diz `error_tracking=on` e
   `version=<sha da imagem>`.

Cada erro chega com `release` = SHA da imagem e a etiqueta `request_id`. A
versão é lida da imagem que a tarefa corre (metadados do ECS) quando
`APP_VERSION` diz `latest`.

Para confirmar de ponta a ponta, com o token de administração
(`nhonga-<env>/ADMIN_API_TOKEN`):

```
curl -X POST -H "x-admin-token: <token>" https://<api>/v1/health/admin/error-test
```

A resposta traz uma referência `diag-xxxxxxxx`; o erro com essa referência
aparece no Sentry em menos de um minuto. Sem o token a resposta é 404.

## Alarmes (SNS → email)

| Alarme                       | Origem                           | O que fazer                                        |
| ---------------------------- | -------------------------------- | -------------------------------------------------- |
| `*-api-error-logs`           | > 20 linhas `ERROR` em 5 min     | Logs Insights por `context`; ver o último deploy.  |
| `*-otp-global-limit`         | `ALERT otp_global_limit_reached` | Possível SMS pumping: ver números e IPs.           |
| `*-payment-review`           | `ALERT payment_review`           | Pagamento com valor diferente: rever no mesmo dia. |
| ALB 5xx, p95, alvos em baixo | métricas do ALB                  | `runbooks/incidentes.md`.                          |
| ECS CPU/memória, RDS         | métricas                         | Escalar ou investigar consultas lentas.            |

Para receber os alarmes, confirmar a subscrição no email enviado pela AWS
depois do primeiro `apply` com `alarm_email`.
