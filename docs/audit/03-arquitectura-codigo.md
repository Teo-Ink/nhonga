# 03 — Arquitectura e qualidade de código

**Pontuação: 6/10**

## Resumo

O monólito modular NestJS e a loja Next.js com BFF são escolhas adequadas à
escala de lançamento. O código é tipado (sem `any` nos tipos da BD,
`Db`/`Tx` derivados do schema) e tem limites de dependências verificados no CI
(dependency-cruiser). A dívida vem sobretudo de ter crescido como demo: fluxos
"admin-lite", publicação anónima, módulo de encomendas legado, falta de
validação por schema e duplicação nas rotas BFF.

## Achados

### ARQ-001 — Sem validação de input centralizada

- Severidade: Média · Esforço: L
- Evidência: os controladores lêem `@Body()` como `Record` e validam à mão
  (`typeof`). Não há Zod nem `ValidationPipe` (`main.ts:62`).
- Recomendação: schemas Zod em `packages/shared`, partilhados pela web e pela
  API, com um pipe global que devolve `422 problem+json`.

### ARQ-002 — README desactualizado

- Severidade: Baixa · Esforço: S
- Evidência: `README.md:17,83` diz que checkout e reconciliação estão
  "untested — needs Postgres" e que as fases 3c/3d estão pausadas.

### ARQ-003 — Código de demonstração e legado no caminho de produção

- Severidade: Média · Esforço: M
- Evidência:
  - `ensureCommunityVendor` (SEC-010);
  - `/ads` com pagamento mock;
  - `/vender/promover` e `/vender/verificar` (só em demo);
  - módulo `payments` de encomendas;
  - `apps/web/lib/demo.ts`.
- Recomendação: remover ou isolar atrás de flags que a configuração de
  produção recusa (já feito para `SEED_DEMO` e `NEXT_PUBLIC_DEMO_MODE`).

### ARQ-004 — Duplicação nas 53 rotas BFF

- Severidade: Média · **Estado: corrigido em `audit/WEB-01-bff-robusto`**
  (`lib/bff.ts`).

### ARQ-005 — Fotografias guardadas como base64 no Postgres

- Severidade: Alta (escala/custo) · Bloqueia: Não no arranque · Esforço: M
- Evidência: `apps/api/src/db/schema/media.ts` (`data_base64 text`).
- Impacto:
  - a BD cresce cerca de 1,33 vezes o tamanho das imagens;
  - os backups ficam maiores;
  - cada imagem passa pela API e pela BD;
  - não há CDN.
- Recomendação: S3 privado com URLs assinadas ou CloudFront com OAC, e uma
  chave no Postgres.

### ARQ-006 — Tarefas periódicas dentro de cada instância da API

- Severidade: Baixa
- Evidência: `checkout.service.ts` (`setInterval` do varrimento) e o worker de
  reconciliação.
- Impacto: com N tarefas, o varrimento corre N vezes. É seguro (idempotente)
  mas desperdiça. Usar EventBridge Scheduler ou um advisory lock.

### ARQ-007 — App mobile fora do workspace e do CI

- Severidade: Média · ver `14-mobile.md`.

### ARQ-008 — Mistura de "tu" e "você" no texto

- Severidade: Baixa · ver `11-ux-usabilidade.md` (UX-003).

## Dívida técnica (estimativa)

| Item                                                           | Esforço      |
| -------------------------------------------------------------- | ------------ |
| Zod em todos os endpoints de escrita                           | L (3–5 dias) |
| Fotos para S3 + CloudFront                                     | M            |
| Remover o legado de encomendas ou isolá-lo                     | M            |
| Backoffice mínimo (moderação, revisão de pagamentos, anúncios) | L            |
| Actualizar o README e a documentação de arquitectura           | S            |

## O que está bem

- Tipos da BD derivados do schema, com comentários de "porquê" úteis.
- `packages/shared` com máquinas de estado testadas (145 testes).
- `problem+json` na API (`ProblemDetailsFilter`).
- Sem TODO/FIXME esquecidos (0 ocorrências).
