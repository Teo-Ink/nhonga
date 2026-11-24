# Relatório executivo — Nhonga, pré-produção (22/11/2026)

## Veredicto: **Não pronto** para produção pública. Pronto para demos controladas.

> **Auditoria pré-produção (24/11/2026):** pronto para piloto fechado depois do
> merge e da criação da produção; ver
> [`17-auditoria-pre-producao.md`](17-auditoria-pre-producao.md).
>
> **Actualização (4.ª ronda, 22/11/2026):** a engenharia que dependia só de
> código está feita (app no SDK 58, reembolsos, fluxo legado removido,
> respostas tipadas, produção com o site, CSP com nonce). O código chega a
> **8,3**; com as tarefas do dono e do advogado, a **≈ 9**.
>
> **Actualização (2.ª ronda, 22/11/2026):** com os 9 ramos novos o código
> chega a **7,7**; com as tarefas do dono e do advogado, a **≈ 8,5**; a nota 9
> precisa ainda de ≈ 2 semanas de engenharia (API, app, reembolsos). Os
> bloqueadores que restam são quase todos do dono: domínio/HTTPS, chaves
> root, protecção do `main`, revisão jurídica. Detalhe em
> [`16-reavaliacao-rumo-a-9.md`](16-reavaliacao-rumo-a-9.md).

A base técnica é boa e a parte do dinheiro foi bem feita. O que impede o
lançamento não é o código principal, mas condições de exploração:

- não há HTTPS nem domínio;
- o staging está aberto;
- há endpoints de administração públicos;
- é possível publicar sem conta;
- não se pode eliminar a conta;
- falta protecção do `main`;
- as chaves root estão em uso;
- a parte jurídica (termos, privacidade, apostas) está por fechar.

Com os 13 branches de correcção já preparados e cerca de 3–4 semanas de
trabalho (ver plano), a Nhonga pode lançar.

## Pontuação (0–10)

| Domínio        | 1.ª ronda | Código (última ronda) | Com o dono |
| -------------- | --------- | --------------------- | ---------- |
| Segurança      | 5 → 7     | 8,5 (4.ª ronda)       | 9,5        |
| Pagamentos     | 7         | 9 (4.ª ronda)         | 9          |
| Arquitectura   | 6         | 9 (4.ª ronda)         | 9          |
| API            | 6         | 9 (4.ª ronda)         | 9          |
| Dados          | 6         | 8                     | 9          |
| Performance    | 4 → 6     | 8                     | 9          |
| Escalabilidade | 6         | 8,5 (4.ª ronda)       | 9          |
| DevOps         | 6         | 8 (4.ª ronda)         | 9          |
| DevSecOps      | 6         | 7,5 (4.ª ronda)       | 9          |
| Testes         | 4 → 6     | 8,5 (4.ª ronda)       | 9          |
| UX             | 6         | 8                     | 8,5        |
| Design e cores | 8         | 9                     | 9          |
| Acessibilidade | 6         | 8                     | 8,5        |
| Mobile         | 4         | 8 (4.ª ronda)         | 8,5        |
| Conformidade   | 4         | 7                     | 9          |
| **Global**     | 5,5 → 6,3 | **8,3** (4.ª ronda)   | **≈ 9**    |

"Código" = todos os ramos `audit/*` juntos ao `main`.

## Top 10 riscos (1.ª ronda; estado na 2.ª entre parênteses)

1. **Sem HTTPS**: sessões e dados em claro (precisa do domínio). _(Aberto — dono.)_
2. **Chaves root da AWS em uso**: quem as obtiver controla a conta. _(Aberto — dono.)_
3. **Login de qualquer número no staging e API pública**: abuso e conteúdo
   indevido com o nome Nhonga. _(Corrigido em SEC-09: falta pôr os números no
   segredo `OTP_DEV_ALLOWLIST`.)_
4. **Publicação de anúncios sem conta**: spam e burlas sem rasto. _(Corrigido
   em SEC-09.)_
5. **Endpoints de administração públicos**: dados comerciais expostos.
   _(Corrigido em SEC-09.)_
6. **Não se pode eliminar a conta nem bloquear utilizadores**: impede a entrada
   nas lojas de apps e cria risco de protecção de dados. _(Corrigido em
   CMP-01.)_
7. **Promessas de reembolso e entrega que a plataforma não cumpre**: risco
   legal (já escondidas por defeito no branch CONT-01). _(Corrigido.)_
8. **Publicidade de apostas sem regras de idade nem parecer jurídico.**
   _(Recusada por defeito em CMP-01; falta o parecer.)_
9. **A pesquisa carrega todos os anúncios para memória**: fica lenta com o
   crescimento. _(Corrigido em DAT-01: p95 ≤ 143 ms com 50 000 anúncios.)_
10. **Sem protecção do `main` e sem error tracking**: erros podem chegar à
    produção sem aviso. _(Error tracking feito em OPS-04; protecção do `main`
    — dono.)_

## Já corrigido (13 branches, à espera de merge)

Corridas no login por SMS, limites de envio de SMS, cabeçalhos de segurança,
produção sem HTTPS bloqueada no Terraform, erros 500 nas páginas quando a API
falha (incluindo a causa do 500 no staging), promessas escondidas, dados de
demonstração bloqueados em produção, vídeo de 6 MB reduzido para 0,7 MB e só em
desktop, SEO e partilha no WhatsApp, fontes sem depender do Google, uploads
seguros (sem GPS nas fotos), alarmes e testes do fluxo de pagamentos com base
de dados real.

## Bloqueadores P0

19 tarefas (`BACKLOG.md`), cerca de **14–20 dias-pessoa** de engenharia, mais:

- tarefas do dono: domínio, chaves root, decisões;
- tarefas jurídicas: termos, privacidade, apostas.

## O que está bem feito

Dinheiro em centavos inteiros e crédito exactamente uma vez, com testes.
Webhooks que nunca são a fonte da verdade. Failover de gateway. Sessões
seguras. Verificação de dono. Infra-estrutura toda em código, com deploy sem
chaves e rollback automático. CI com análise de segredos, dependências e
infra-estrutura. Paleta com contraste verificado. Português de Moçambique
cuidado.

## O que não foi possível auditar

- Consola AWS (CloudTrail, GuardDuty, custos reais).
- App compilada num telemóvel.
- Lighthouse em rede 3G real.
- Testes de carga: o plano e o script estão prontos, mas precisam de
  autorização.
- Contratos dos gateways e do SMS.
- Validação jurídica.

## Próximos passos

1. Rever e juntar os 13 branches, pela ordem do `BACKLOG.md`.
2. Mover as propostas de CI e deploy (`docs/audit/ci`).
3. Tomar as 5 decisões de `DECISOES.md`.
4. Registar o domínio e seguir `docs/runbooks/https.md`.
5. Reunião com o advogado (termos, privacidade, apostas).
