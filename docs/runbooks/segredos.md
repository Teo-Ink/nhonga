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

### Assistente de IA (staging e produção)

O site funciona sem a chave: o assistente fica desligado. O Terraform escreve
um marcador (`definir-chave`) que a API ignora. Para o ligar:

1. Em <https://platform.claude.com>, crie uma chave de API só para a Nhonga
   (uma por ambiente) e ponha um limite de gasto mensal na consola.
2. Ponha-a no segredo (escreva-a só no terminal, nunca num ficheiro do repo):

```bash
aws secretsmanager put-secret-value --secret-id nhonga-staging/ANTHROPIC_API_KEY --secret-string 'sk-ant-…'
aws ecs update-service --cluster nhonga-staging --service api --force-new-deployment
```

3. Confirme: `curl http://<ALB>:8080/v1/assistant/status` devolve
   `{"configured":true}` e o assistente responde no site.

O tecto mensal é `ASSISTANT_MONTHLY_TOKEN_CAP` (staging 500 000, produção
2 000 000 tokens). O modelo por defeito é `claude-sonnet-5-5`
(`ANTHROPIC_MODEL` para mudar).

Depois de mudar um valor, force um novo deploy do serviço para as tarefas o
lerem: `aws ecs update-service --cluster nhonga-$ENV --service api --force-new-deployment`.

## Ler o token de operações

```bash
aws secretsmanager get-secret-value --secret-id nhonga-$ENV/ADMIN_API_TOKEN --query SecretString --output text
```
