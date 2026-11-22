# Segredos (Secrets Manager)

O Terraform cria os **contentores** dos segredos e escreve os valores que ele
próprio gera (URL da base de dados, token de operações). Nunca os lê de volta:
o papel de _plan_ dos PRs está proibido de ler segredos, e assim o
"Plan (staging)" deixa de falhar (P0-14).

## Valores que o dono põe (uma vez por ambiente)

Produção não arranca sem eles (é intencional):

```bash
ENV=production
aws secretsmanager put-secret-value --secret-id nhonga-$ENV/PAWAPAY_API_TOKEN  --secret-string '<token do painel PawaPay>'
aws secretsmanager put-secret-value --secret-id nhonga-$ENV/SMS_GATEWAY_URL    --secret-string 'https://<gateway>/send'
aws secretsmanager put-secret-value --secret-id nhonga-$ENV/SMS_GATEWAY_TOKEN  --secret-string '<token do gateway SMS>'
```

Staging: números autorizados a entrar (SMS simulado):

```bash
aws secretsmanager put-secret-value --secret-id nhonga-staging/OTP_DEV_ALLOWLIST --secret-string '84xxxxxxx,85xxxxxxx'
```

Depois de mudar um valor, force um novo deploy do serviço para as tarefas o
lerem: `aws ecs update-service --cluster nhonga-$ENV --service nhonga-$ENV-api --force-new-deployment`.

## Ler o token de operações

```bash
aws secretsmanager get-secret-value --secret-id nhonga-$ENV/ADMIN_API_TOKEN --query SecretString --output text
```
