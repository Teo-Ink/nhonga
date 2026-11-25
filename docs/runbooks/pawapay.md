# PawaPay: configuração e avisos assinados (PAY-07)

A PawaPay avisa a API quando um pagamento termina (callback). A API protege-se
de duas formas independentes:

1. **Assinatura.** Com os "signed callbacks" ligados no painel, cada aviso vem
   assinado pela PawaPay. A API verifica a assinatura, o conteúdo, o endereço
   de destino e a validade (60 segundos). Um aviso com assinatura inválida é
   sempre recusado (401).
2. **Confirmação.** Do aviso só se aproveita o identificador do pagamento; o
   estado é sempre perguntado de novo à PawaPay com o token da API. Um aviso
   falso não credita nada.

## Variáveis

| Variável                           | Valor                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `PAWAPAY_API_TOKEN`                | Segredo `nhonga-<env>/PAWAPAY_API_TOKEN`                                      |
| `PAWAPAY_BASE_URL`                 | Sandbox: `https://api.sandbox.pawapay.io`. Produção: `https://api.pawapay.io` |
| `PAWAPAY_CALLBACK_URL`             | Por omissão `<PUBLIC_API_URL>/v1/checkout/webhooks/pawapay`                   |
| `PAWAPAY_REQUIRE_SIGNED_CALLBACKS` | `true` recusa avisos sem assinatura. Produção: `true`                         |

As chaves públicas da PawaPay são lidas de `<PAWAPAY_BASE_URL>/v2/public-key/http`
e guardadas em memória (renovadas uma vez por dia).

## No painel da PawaPay (uma vez por ambiente)

1. **Developers → Callback URLs.** Em Deposits e Refunds:
   `https://api.<domínio>/v1/checkout/webhooks/pawapay`. Payouts e Checkouts
   podem levar o mesmo endereço (a API ignora o que não conhece).
2. **Developers → API Security.** Ligar os callbacks assinados.
3. **Developers → Create API Token.** Guardar o token directamente no segredo:
   `aws secretsmanager put-secret-value --region af-south-1 --secret-id nhonga-<env>/PAWAPAY_API_TOKEN --secret-string "<token>"`
4. Reiniciar o serviço `api`.

O endereço tem de ser exactamente o que a API espera (o mesmo domínio e
caminho): a assinatura cobre-os. Com ou sem `/v1` são ambos aceites.

## Diagnóstico

Um aviso recusado fica no registo como `webhook pawapay: bad_signature (<motivo>)`:

| Motivo            | Causa provável                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| `unsigned`        | Callbacks assinados desligados no painel                               |
| `bad_signature`   | Endereço no painel diferente de `PAWAPAY_CALLBACK_URL`, ou aviso falso |
| `unknown_key`     | `PAWAPAY_BASE_URL` aponta para o ambiente errado (sandbox/produção)    |
| `expired`         | Relógio do servidor errado, ou aviso repetido por terceiros            |
| `digest_mismatch` | Corpo alterado no caminho (um proxy a reescrever o JSON)               |

Mesmo com avisos recusados, um pagamento é creditado quando o comprador volta
à página de pagamento, porque o estado é consultado directamente.
