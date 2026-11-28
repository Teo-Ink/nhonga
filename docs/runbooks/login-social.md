# Entrar com Google ou Facebook (AUTH-10)

Além do número de telefone, uma pessoa pode entrar ou registar-se com a conta
Google ou Facebook. Os botões só aparecem para os fornecedores configurados.

## Regras

- Uma conta Google/Facebook corresponde a uma conta Nhonga, pelo identificador
  que o fornecedor dá à pessoa (nunca pelo e-mail).
- Uma conta Google/Facebook desconhecida abre sempre uma conta Nhonga **nova**.
  Para usar a mesma conta com o telefone e com o Google, a pessoa liga-os em
  Conta → Privacidade e conta → Formas de entrar.
- Quem entra só com Google/Facebook pode navegar, guardar favoritos e enviar
  mensagens. Para **publicar anúncios** e para **alertas por SMS** tem de
  confirmar um número de telefone (código por SMS).
- Não se pode desligar a única forma de entrar numa conta.
- Não guardamos nenhum token do Google ou do Facebook, só o identificador e o
  e-mail.

## Configurar (uma vez por ambiente)

O endereço de retorno é fixo:

| Ambiente | Endereços de retorno (redirect URIs)                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Staging  | `https://staging.nhonga.co.mz/api/auth/social/google/callback` e `…/facebook/callback` |
| Produção | `https://nhonga.co.mz/api/auth/social/google/callback` e `…/facebook/callback`         |

### Google

1. Em <https://console.cloud.google.com/>: criar um projecto, depois
   "APIs & Services" → "OAuth consent screen" (tipo External; nome Nhonga;
   e-mail de apoio; domínio `nhonga.co.mz`; ligações para `/privacidade` e
   `/termos`). Âmbitos: `openid`, `email`, `profile` (não exigem verificação).
2. "Credentials" → "Create credentials" → "OAuth client ID" → tipo
   "Web application". Em "Authorized redirect URIs" pôr o endereço de retorno
   do ambiente.
3. Guardar o Client ID e o Client secret nos segredos:

   ```
   aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/GOOGLE_CLIENT_ID --secret-string "<client id>"
   aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/GOOGLE_CLIENT_SECRET --secret-string "<client secret>"
   ```

4. Publicar o ecrã de consentimento ("Publish app"). Em modo de teste só
   entram as contas listadas como testadores.

### Facebook

1. Em <https://developers.facebook.com/>: criar uma app (caso de uso
   "Authenticate and request data from users with Facebook Login").
2. Em "Facebook Login" → "Settings" → "Valid OAuth Redirect URIs" pôr o
   endereço de retorno do ambiente. Em "App settings" → "Basic" preencher o
   domínio, o URL da política de privacidade e o URL de eliminação de dados
   (`https://nhonga.co.mz/conta/privacidade`).
3. Guardar o App ID e o App secret:

   ```
   aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/FACEBOOK_APP_ID --secret-string "<app id>"
   aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/FACEBOOK_APP_SECRET --secret-string "<app secret>"
   ```

4. Pedir "Advanced access" para `email` e `public_profile` e passar a app a
   "Live". Em modo de desenvolvimento só entram os administradores e
   testadores da app.

### Activar

Reiniciar a API para ler os segredos:

```
aws ecs update-service --region af-south-1 --cluster nhonga-<env> --service api --force-new-deployment
```

Confirmar: `https://api-<env>…/v1/auth/social/providers` devolve
`{"providers":["google","facebook"]}` e os botões aparecem em `/entrar`.

## Diagnóstico

No registo da API, contexto `SocialAuth`:

| Mensagem                             | Causa provável                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| `provider_rejected … invalid_grant`  | Endereço de retorno diferente do registado no fornecedor     |
| `provider_rejected … invalid_client` | Client secret errado                                         |
| `invalid_identity`                   | Resposta que não é para esta app (não deve acontecer)        |
| `provider_unavailable`               | O fornecedor não respondeu; a pessoa pode entrar pelo número |

O visitante volta sempre a `/entrar` com uma mensagem genérica; o motivo
exacto fica só no registo.
