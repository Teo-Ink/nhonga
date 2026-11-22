# 04 — API

**Pontuação: 6/10**

## Achados

### API-001 — `null` responde com corpo vazio e partia a BFF

- Severidade: Alta · **Estado: corrigido em `audit/WEB-01-bff-robusto`**
- Evidência: no staging, `/api/mine/shop` com sessão e sem loja respondia 500.
  Reproduzido localmente: a API responde 200 sem corpo, e `res.json()` lança.
- Correcção: `readJson()` nas 9 rotas que liam o corpo; o caso devolve agora
  200 `null`.
- Recomendação extra: a API devia responder `{ "shop": null }` ou 204, de
  forma explícita.

### API-002 — Endpoints admin públicos

- Severidade: Alta · ver SEC-009.

### API-003 — Sem versionamento

- Severidade: Baixa
- As rotas não têm prefixo `/v1`. A app mobile vai depender da API: introduzir
  `/v1` (com alias) antes da primeira versão nas lojas.

### API-004 — Criações sem `Idempotency-Key`

- Severidade: Baixa
- `POST /catalog/products`, `/conversations` e `/checkout/*` não aceitam chave
  de idempotência. Em 3G, um reenvio pode duplicar anúncios. O checkout já é
  idempotente por intenção.

### API-005 — Limites de payload

- **Estado: corrigido** (SEC-007): 100 KB por defeito, 12 MB nas rotas de fotos.

### API-006 — Validação e formato de erros

- Severidade: Média · ver ARQ-001. Os erros já usam `problem+json`, mas as
  mensagens variam entre inglês ("Not your listing", "title too short") e
  português.

## O que está bem

- OpenAPI em `apps/api/openapi.yaml` com lint no CI.
- Paginação com tecto (`limit` entre 1 e 48, `catalog.service.ts:742`).
- Respostas públicas sem campos internos: o telefone só aparece com opt-in, e
  `listAdmin` não devolve o contacto do anunciante.
- Rate limit por sessão ou IP (em memória: SEC-004), com webhooks e health
  isentos.
