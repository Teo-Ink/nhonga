# 10 — Testes e QA

**Pontuação: 4/10 antes; 6/10 com os branches**

## Inventário

| Pacote            | Antes                                        | Com os branches `audit/*`                                                                                           |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | 145 unitários (máquinas de estado, telefone) | 145                                                                                                                 |
| `apps/api`        | 124 unitários                                | 124 + 18 unitários (limites OTP, corpo, imagens, config) + 3 OTP e 3 limites com Postgres + 7 checkout com Postgres |
| `apps/web`        | 0                                            | 9 (BFF) + 2 (promessas)                                                                                             |
| `apps/mobile`     | 0                                            | 0                                                                                                                   |
| E2E               | 0                                            | 0                                                                                                                   |

Os testes com Postgres correm quando há `TEST_DATABASE_URL` (passado pelo
Turbo). Sem ele, são saltados de forma visível.

## Achados

### TST-001 — Web sem testes

- Alta · **Parcial**: Vitest configurado em `audit/WEB-01-bff-robusto`, com
  testes da BFF e das promessas. Falta Testing Library para componentes.

### TST-002 — Checkout e reconciliação sem testes com Postgres

- Alta · **Feito** para o checkout alojado (`audit/TEST-02-integracao-checkout`).
- O módulo legado de encomendas (`payments/*`) continua sem testes. Decidir
  com PAG-006.

### TST-003 — Sem E2E

- Alta · Esforço: L. Playwright com viewport de 360 px para os fluxos:
  pesquisa, ver anúncio, login com OTP mock, publicar anúncio, contactar
  vendedor, denunciar e carregar a carteira no simulador. Correr contra
  `docker compose`.

### TST-004 — CI sem Postgres

- Alta · **Proposto** em `docs/audit/ci/ci.yml.proposta`: serviço
  `postgres:16` no job `test`, com `TEST_DATABASE_URL`. Os ficheiros em
  `.github/workflows` têm de ser movidos à mão.

### TST-005 — App mobile sem testes nem CI

- Média · ver MOB-001.

## Estratégia (pirâmide)

1. **Unitários** (rápidos, a maioria): helpers puros (formatação, limites,
   telefone), mapeadores e máquinas de estado.
2. **Integração com Postgres**: tudo o que mexe em dinheiro ou corridas
   (checkout, OTP, carteira, publicação com fotos, denúncias).
3. **Contrato**: OpenAPI lint (já existe), mais validação dos exemplos com o
   schema.
4. **E2E** (poucos, críticos): os 7 fluxos acima, em mobile 360 px.

## Testes a escrever a seguir (por prioridade)

1. `WalletService.debit` concorrente (compra de destaque duas vezes em
   paralelo → um débito).
2. `createListing` exige sessão (depois de SEC-010) e limita fotos e tamanho.
3. Denúncia de anúncio grava e respeita os limites.
4. Messaging: um não participante recebe 404 ao ler ou escrever.
5. BFF: cada rota com a API em baixo devolve 503 ou o fallback (tabela de
   casos).
