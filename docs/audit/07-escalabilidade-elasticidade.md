# 07 — Escalabilidade e elasticidade

**Pontuação: 6/10**

## Estado

| Item              | Staging                                                                        | Produção (Terraform)              |
| ----------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| API (ECS Fargate) | 1 tarefa, auto-scaling 1–4 por CPU                                             | 2–8                               |
| Web (ECS Fargate) | 1 tarefa, 1–3                                                                  | não definido (só staging tem web) |
| RDS               | db.t4g.small, single-AZ                                                        | db.t4g.medium, Multi-AZ           |
| NAT               | 1 (ponto único de falha assumido, `modules/network/main.tf:7-10`)              | 1                                 |
| Deploy            | rolling com circuit breaker e rollback (`modules/ecs-service/main.tf:191-197`) | idem                              |

A aplicação é stateless: sessões na BD e imagens na BD. Mas o rate limit está
em memória (SEC-004) e as tarefas periódicas correm em cada instância
(ARQ-006).

## Achados

### ESC-001 — Limites por instância

- Alta · ver SEC-004.

### ESC-002 — NAT único

- Média. Se o NAT ou a sua AZ falhar, os pagamentos, a IA e o SMS param.
  Produção: um NAT por AZ (~38 USD/mês cada) ou VPC endpoints para Secrets
  Manager, ECR e Logs.

### ESC-003 — Ligações à BD

- Média. Pool de 10 por tarefa (`DB_POOL_MAX`): com 8 tarefas de API são 80
  ligações, mais os picos de arranque. O db.t4g.medium aguenta cerca de 400.
  Há alarme em OPS-02. Considerar RDS Proxy se a escala passar de 8 tarefas.

### ESC-004 — A pesquisa não escala

- Alta · ver DAT-001.

### ESC-005 — A produção não tem serviço web

- Alta · Bloqueia: Sim. `envs/production/main.tf` só cria a API. Replicar o
  módulo `web` e o encaminhamento por host quando houver domínio
  (`www` → web, `api` → API).

## Plano de testes de carga (NÃO executado; precisa de autorização)

Ferramenta: k6. Alvo: staging, nunca produção. Cenários:

| Cenário          | Mistura                                    | Carga                          | Critério                        |
| ---------------- | ------------------------------------------ | ------------------------------ | ------------------------------- |
| Navegação        | 70% home/categoria/anúncio, 30% pesquisa   | rampa 0→50 VU em 5 min, 15 min | p95 < 1,5 s, erros < 1%         |
| Pesquisa         | consultas reais em pt                      | 20 VU                          | p95 < 800 ms                    |
| Publicação       | login mock + anúncio com 3 fotos de 300 KB | 5 VU                           | sem 5xx, memória < 80%          |
| Pico de campanha | navegação × 5 durante 2 min                | 250 VU                         | o auto-scaling reage em < 3 min |

Script de exemplo: `docs/audit/carga/navegacao.k6.js`.

## Custos AWS (estimativa, af-south-1, preços públicos)

| Recurso                       | Staging/mês                    | Produção/mês                    |
| ----------------------------- | ------------------------------ | ------------------------------- |
| NAT gateway + tráfego         | ~40 USD                        | ~40–80 USD                      |
| ALB                           | ~20 USD                        | ~25 USD                         |
| RDS                           | db.t4g.small single-AZ ~30 USD | db.t4g.medium Multi-AZ ~120 USD |
| ECS Fargate                   | 2 tarefas ~25 USD              | 2–8 tarefas ~50–200 USD         |
| Logs, Secrets, ECR, Cloud Map | ~5 USD                         | ~10–20 USD                      |
| **Total**                     | **~120 USD**                   | **~250–450 USD**                |

Optimizações:

- desligar o staging fora de horas (ECS a 0 e RDS parado);
- Fargate Spot no staging;
- VPC endpoints em vez de tráfego NAT para ECR e Logs;
- AWS Budgets com alarme (SEC-008).
