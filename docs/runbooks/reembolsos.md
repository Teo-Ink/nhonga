# Reembolsos (P2-02)

Um reembolso devolve ao pagador um carregamento ou um pacote pago por M-Pesa
ou e-Mola (PawaPay). Regras:

- **Um reembolso por pagamento, pelo valor total.**
- Se o pagamento foi creditado na carteira, o crédito sai da carteira **na
  mesma operação**. Se o vendedor já o gastou, a API recusa (409): trate o caso
  à mão (acordo com o vendedor) e registe-o.
- Se o pagamento está em **revisão** (valor diferente do pedido), nunca foi
  creditado: só o dinheiro volta.
- Se o gateway recusar, o crédito é reposto (`refund_reversal`) e dispara o
  alarme `*-refund-failed`.
- PaySuite não tem reembolso por API: a API responde 409 e o reembolso faz-se
  no painel da PaySuite.

## Fazer um reembolso

O token de operações está no Secrets Manager (`<projecto>-<env>/ADMIN_API_TOKEN`).

```bash
TOKEN=$(aws secretsmanager get-secret-value --secret-id nhonga-production/ADMIN_API_TOKEN \
  --query SecretString --output text)

# estado do pagamento e do reembolso
curl -s https://api.nhonga.co.mz/v1/checkout/admin/<id> -H "x-admin-token: $TOKEN"

# reembolsar (o motivo fica registado)
curl -s -X POST https://api.nhonga.co.mz/v1/checkout/admin/<id>/refund \
  -H "x-admin-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"reason":"Cliente pagou duas vezes"}'
```

`refundStatus`: `pending` (aceite pela PawaPay, em curso), `refunded`
(concluído), `failed` (recusado; crédito reposto). Para actualizar um
`pending`, chame de novo o `GET …/admin/<id>`.

A política de reembolso (prazos, casos aceites) é decidida pelo dono com o
advogado; este procedimento só executa a decisão.
