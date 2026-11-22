# Propostas de alteração aos workflows

As ferramentas do agente não escrevem em `.github/workflows` (caminho
protegido). Estes ficheiros são versões completas para rever e mover à mão:

| Proposta              | Substitui                      | O que muda                                                                                                                    |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml.proposta`     | `.github/workflows/ci.yml`     | Postgres 16 como serviço no job de testes, com `TEST_DATABASE_URL` (TEST-02); novo job `mobile` (MOB-01)                      |
| `deploy.yml.proposta` | `.github/workflows/deploy.yml` | Salta o build se a imagem já existir no ECR (DEV-004); `trivy image` a falhar em HIGH/CRITICAL antes do push da API (DSO-003) |

Antes de mover a proposta de CI, o branch `audit/SEC-01-otp-atomico` (que passa
`TEST_DATABASE_URL` pelo Turbo) tem de estar no `main`. Confirmar a versão da
imagem do Trivy (`aquasec/trivy`) e fixá-la por digest quando a mover.

Para aplicar, na raiz do repositório:

```
copy /y docs\audit\ci\ci.yml.proposta .github\workflows\ci.yml
copy /y docs\audit\ci\deploy.yml.proposta .github\workflows\deploy.yml
```
