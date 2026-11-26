# Runbook — Activar HTTPS e domínio (OPS-01)

> **Staging (OPS-07):** já está em código. Com a zona `nhonga.co.mz` no
> Route 53 e o certificado `nhonga.co.mz` + `*.nhonga.co.mz` emitido, o
> Terraform de staging cria `staging.nhonga.co.mz` (site) e
> `api-staging.nhonga.co.mz` (API), redirecciona 80 → 443, fecha a porta 8080
> e passa o cookie de sessão a `Secure`. Os nomes têm um só nível porque o
> certificado cobre `*.nhonga.co.mz` e não `*.staging.nhonga.co.mz`.
> Para voltar atrás: `certificate_arn = ""` em `envs/staging`.

Pré-requisito do dono: domínio `nhonga.co.mz` registado (OQ-1), com acesso ao
painel DNS.

## 1. Zona DNS

1. Criar a hosted zone `nhonga.co.mz` no Route 53 (ou manter o DNS no registo).
2. Se usar Route 53, apontar os NS do registo para os 4 servidores da zona.

## 2. Certificado ACM (região af-south-1, a mesma do ALB)

1. ACM → Request certificate → público, com nomes:
   `nhonga.co.mz`, `www.nhonga.co.mz`, `api.nhonga.co.mz`, `staging.nhonga.co.mz`.
2. Validação por DNS: criar os CNAME que o ACM indica. Esperar pelo estado
   `Issued` (minutos a algumas horas).
3. Copiar o ARN: `arn:aws:acm:af-south-1:526156223765:certificate/…`.

## 3. Terraform

1. Staging: `certificate_arn` em `envs/staging` (variável), via
   `TF_VAR_certificate_arn` no ambiente `staging` do GitHub ou num `tfvars`.
2. Produção: o mesmo em `envs/production`. A validação de SEC-05 recusa o plano
   sem um ARN válido.
3. Com certificado, o módulo `alb`:
   - redirecciona 80 → 443;
   - serve 443 com TLS 1.2+;
   - **não cria** o listener `api_public` (porta 8080).
4. Encaminhamento por host (ainda por fazer): `api.nhonga.co.mz` → target group
   da API; o resto → web. Esta regra de listener não existe hoje. É uma
   alteração pequena no módulo `alb`.

## 4. Registos DNS

- `nhonga.co.mz` e `www` → ALIAS para o ALB (zona do output `zone_id`).
- `api` → ALIAS para o mesmo ALB (regra por host).

## 5. Aplicação

1. Web: remover `SESSION_COOKIE_INSECURE` do módulo `web` (o cookie passa a
   `Secure`).
2. Web: `SITE_URL=https://nhonga.co.mz` e, só em produção,
   `SITE_INDEXABLE=1`.
3. API: `PUBLIC_WEB_URL=https://nhonga.co.mz`,
   `PUBLIC_API_URL=https://api.nhonga.co.mz`,
   `CORS_ORIGINS=https://nhonga.co.mz`.
4. Remover `api_public_port` dos módulos `security_groups` e `alb`.
5. HSTS é automático: o middleware envia
   `Strict-Transport-Security: max-age=31536000; includeSubDomains` quando
   `x-forwarded-proto=https` (SEC-03). Pedir a inclusão na lista de preload
   só depois de 1–2 semanas estável.
6. App mobile: `EXPO_PUBLIC_API_URL=https://api.nhonga.co.mz` nos perfis
   `preview` e `production` do `eas.json` (MOB-003).
7. Gateways: actualizar os URLs de webhook nos painéis PawaPay e PaySuite.

## 6. Verificação

```
curl -sI https://nhonga.co.mz | grep -iE "strict-transport|content-security"
curl -sI http://nhonga.co.mz        # 301 para https
curl -s https://api.nhonga.co.mz/health/ready
```

Abrir o site, entrar e confirmar que o cookie `nhonga_session` tem `Secure`.

## Reverter

Repor `certificate_arn=""` só no staging (a produção não o aceita), voltar a
pôr `SESSION_COOKIE_INSECURE=1` e `api_public_port`. O HSTS já enviado fica no
browser durante `max-age`. Por isso, não reverter depois de semanas com HSTS.
