# Relatório executivo — Nhonga, pré-produção (22/11/2026)

## Veredicto: **Não pronto** para produção pública. Pronto para demos controladas.

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

| Domínio        | Nota    |     | Domínio        | Nota            |
| -------------- | ------- | --- | -------------- | --------------- |
| Segurança      | 5 → 7\* |     | DevSecOps      | 6               |
| Pagamentos     | 7       |     | Testes         | 4 → 6\*         |
| Arquitectura   | 6       |     | UX             | 6               |
| API            | 6       |     | Design e cores | 8               |
| Dados          | 6       |     | Acessibilidade | 6               |
| Performance    | 4 → 6\* |     | Mobile         | 4               |
| Escalabilidade | 6       |     | Conformidade   | 4               |
| DevOps         | 6       |     | **Global**     | **5,5 → 6,3\*** |

\* com os branches `audit/*` juntos ao `main`.

## Top 10 riscos

1. **Sem HTTPS**: sessões e dados em claro (precisa do domínio).
2. **Chaves root da AWS em uso**: quem as obtiver controla a conta.
3. **Login de qualquer número no staging e API pública**: abuso e conteúdo
   indevido com o nome Nhonga.
4. **Publicação de anúncios sem conta**: spam e burlas sem rasto.
5. **Endpoints de administração públicos**: dados comerciais expostos.
6. **Não se pode eliminar a conta nem bloquear utilizadores**: impede a entrada
   nas lojas de apps e cria risco de protecção de dados.
7. **Promessas de reembolso e entrega que a plataforma não cumpre**: risco
   legal (já escondidas por defeito no branch CONT-01).
8. **Publicidade de apostas sem regras de idade nem parecer jurídico.**
9. **A pesquisa carrega todos os anúncios para memória**: fica lenta com o
   crescimento.
10. **Sem protecção do `main` e sem error tracking**: erros podem chegar à
    produção sem aviso.

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
