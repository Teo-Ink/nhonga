# Reclamações

O canal formal de reclamações está em `/reclamacoes` (site) e fica guardado na
tabela `complaint`. O regulamento do INTIC (Decreto n.º 59/2023, art. 45) pede
que o sistema de reclamações seja conservado 5 anos: **nada apaga estas
linhas**, nem a eliminação da conta de quem reclamou.

## Ver as reclamações por responder

```bash
curl -H "x-admin-token: $ADMIN_API_TOKEN" "https://api.nhonga.co.mz/v1/complaints/admin?status=open"
```

Cada reclamação tem uma referência (`R-2026-XXXXXX`), o nome, o contacto, o
assunto e o texto.

## Responder

1. Responda à pessoa pelo contacto que deixou (telefone ou email).
2. Registe a resposta, para ficar guardada com a reclamação:

```bash
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" -H "content-type: application/json" \
  -d '{"status":"answered","resolution":"Saldo creditado a 24/11; cliente informado por SMS."}' \
  "https://api.nhonga.co.mz/v1/complaints/admin/R-2026-XXXXXX/resolve"
```

Use `"closed"` quando a reclamação não tiver seguimento (duplicada, sem
contacto válido).

## Regras

- Prazo de resposta: **[a definir com o advogado]** dias úteis.
- Reclamações sobre reembolsos: ver `reembolsos.md`.
- Reclamações sobre dados pessoais: passar à pessoa responsável pela protecção
  de dados.
- Limite contra abuso: 5 reclamações por hora por cliente.
