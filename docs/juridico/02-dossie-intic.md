# Dossiê para o registo e licenciamento no INTIC

**Data:** 24/11/2026 · Preparado a partir do Decreto n.º 59/2023 (alterado pelo
Decreto n.º 44/2025) e das perguntas frequentes do INTIC (Janeiro de 2026).

> Não é parecer jurídico. Confirme a lista e os valores com o INTIC antes de
> submeter: `registo.licenciamento@intic.gov.mz`, (+258) 21 49 87 86/7,
> Rua José Mateus n.º 437, Maputo.

## Como funciona

1. **Registo** da plataforma e das aplicações (site e app). O Certificado de
   Registo é pré-requisito da licença.
2. **Licença**, pedida depois de o registo ser validado. Válida por 5 anos,
   renovável.
3. O pedido submete-se no site do INTIC (`intic.gov.mz/registo-e-licenciamento/`)
   ou no balcão, em formulário próprio.
4. Prazos do regulamento: aviso de documentos em falta em 10 dias, 15 a 30
   dias para corrigir, decisão em 60 dias.

**Categoria provável do Nhonga:** operador de plataforma digital —
_mercado digital_ (marketplace). Confirmar a classe com o INTIC.

## Custos

| Taxa                  | Valor                                                                                     | Nota                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Licenciamento (única) | 8 758,00 MT (um salário mínimo), segundo o documento de requisitos do INTIC de 25/02/2026 | Confirmar o valor actual                                                                          |
| Anual                 | 1 % da receita bruta operacional, até 31 de Março                                         | **Não se aplica a startups** com capital social até 50 000 MT e facturação anual até 2 500 000 MT |

## Documentos do registo

| #   | Documento                                                                                                                     | Quem trata    | Estado                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------- |
| 1   | Formulário do INTIC preenchido                                                                                                | Dono          | Por fazer                         |
| 2   | Cópia do documento de identificação do representante legal                                                                    | Dono          | Por fazer                         |
| 3   | NUIT da empresa                                                                                                               | Dono          | Por fazer                         |
| 4   | Certidão definitiva da empresa (registo comercial)                                                                            | Dono          | Por fazer                         |
| 5   | Comprovativo do registo do domínio (`nhonga.co.mz`)                                                                           | Dono          | **Depende de registar o domínio** |
| 6   | Procuração, se for um representante a submeter                                                                                | Dono/advogado | Se aplicável                      |
| 7   | Endereços IP públicos ou ASN                                                                                                  | Engenharia    | Ver nota abaixo                   |
| 8   | Documentação técnica (serviços, arquitectura, infra-estrutura, localização das bases de dados, segurança, protecção de dados) | Engenharia    | **Rascunho abaixo**               |

## Documentos da licença

| #   | Documento                                                                                                                          | Quem trata    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Requerimento que sustenta o pedido (modelo abaixo)                                                                                 | Dono/advogado |
| 2   | NUIT da empresa                                                                                                                    | Dono          |
| 3   | Procuração, se aplicável                                                                                                           | Dono/advogado |
| 4   | Estatutos publicados no Boletim da República e descrição do projecto (art. 24 do regulamento de 2023; confirmar se ainda é pedido) | Dono          |

**Nota sobre os endereços IP.** O Nhonga está alojado na AWS e não tem ASN
próprio. Os IP públicos do balanceador de carga são atribuídos pela AWS e
podem mudar. Depois de registar o domínio, indicar ao INTIC o domínio, o nome
DNS do balanceador e o intervalo de IP da AWS na região `af-south-1`, e
perguntar se aceitam esta forma. Se exigirem IP fixos, a engenharia pode
reservar endereços estáticos.

## Documentação técnica (rascunho para anexar)

### 1. Serviços prestados

O Nhonga é um mercado digital de anúncios classificados para Moçambique, em
`nhonga.co.mz` e em aplicação móvel (Android e iOS).

- Publicação e pesquisa de anúncios de particulares e lojas (gratuito).
- Mensagens entre compradores e vendedores.
- Serviços pagos opcionais ao vendedor: destaques, Loja Pro, pacotes e
  banners, pagos por M-Pesa, e-Mola ou cartão através de prestadores de
  pagamento terceiros. O Nhonga não processa nem retém o pagamento das vendas
  entre utilizadores.
- Assistente de inteligência artificial para ajuda na pesquisa e na criação
  de anúncios.

### 2. Arquitectura e sistemas de informação

| Componente      | Tecnologia                                                 | Função                                                 |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Site            | Next.js (contentor em AWS ECS Fargate)                     | Interface web; intermediário entre o navegador e a API |
| Aplicação móvel | Expo / React Native                                        | Interface Android e iOS                                |
| API             | NestJS (contentor em AWS ECS Fargate)                      | Regras de negócio, autenticação, pagamentos            |
| Base de dados   | PostgreSQL 16 (AWS RDS)                                    | Contas, anúncios, mensagens, carteira                  |
| Ficheiros       | AWS S3 com CDN                                             | Fotografias dos anúncios                               |
| Entrada         | Balanceador de carga (ALB) com firewall aplicacional (WAF) | Tráfego HTTPS                                          |
| Segredos        | AWS Secrets Manager                                        | Chaves e credenciais                                   |

### 3. Infra-estrutura e localização dos dados

- **Fornecedor:** Amazon Web Services.
- **Região:** `af-south-1` (Cidade do Cabo, África do Sul). **A base de dados
  dos utilizadores nacionais está fora de Moçambique**, nesta região.
- Rede privada (VPC) com sub-redes privadas para a API e a base de dados; só o
  balanceador está exposto à Internet.
- Produção: base de dados em duas zonas de disponibilidade, cópias de
  segurança automáticas guardadas 35 dias, protecção contra eliminação.

_(Anexar o diagrama de `docs/` do repositório.)_

### 4. Subcontratantes

| Fornecedor          | Serviço                    | País          |
| ------------------- | -------------------------- | ------------- |
| Amazon Web Services | Alojamento                 | África do Sul |
| PawaPay, PaySuite   | Pagamentos móveis e cartão | [confirmar]   |
| [Fornecedor de SMS] | Códigos de acesso          | [confirmar]   |
| Anthropic           | Assistente de IA           | EUA           |
| fal.ai              | Imagens de banners         | EUA           |

### 5. Segurança

- Ligações cifradas (HTTPS/TLS); base de dados cifrada em repouso.
- Autenticação por código de uso único enviado por SMS; sessões de 7 dias.
- Limites contra abuso, firewall aplicacional, cabeçalhos de segurança e
  política de segurança de conteúdo.
- Segredos fora do código; acessos à infra-estrutura por funções com
  privilégio mínimo.
- Registo de auditoria imutável das acções administrativas; alarmes de
  operação.
- Análise automática de vulnerabilidades e de segredos em cada alteração ao
  código.

### 6. Protecção de dados

- Dados tratados: telemóvel, nome, anúncios, mensagens, registos de
  pagamentos, registos técnicos (ver a Política de Privacidade em
  `/privacidade`).
- O utilizador pode descarregar os seus dados e eliminar a conta sozinho.
- Não há venda de dados nem publicidade comportamental de terceiros.
- Pessoa responsável pela protecção de dados: **[nome e contacto]**.

## Requisitos que o regulamento impõe depois da licença

| Requisito                                                          | Estado no Nhonga                                                                                      | O que falta                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Representante legal em Moçambique, com contactos públicos (art. 6) | Empresa moçambicana                                                                                   | Publicar os contactos nos Termos                                       |
| Termos e regras de moderação em linguagem simples (art. 7)         | Feito (rascunho)                                                                                      | Aprovação do advogado                                                  |
| Notificação prévia do tratamento de dados pessoais (art. 38)       | Por fazer                                                                                             | Perguntar ao INTIC como se faz                                         |
| Registos de acesso guardados 5 anos (art. 42)                      | **Preparado para produção:** registos de acesso do balanceador de carga em S3 durante 5 anos (LEG-02) | Confirmar com o INTIC se estes registos bastam; aplicar com a produção |
| Sistema de reclamações, guardadas 5 anos (art. 45)                 | **Feito:** página `/reclamacoes`, referência por reclamação, registo sem eliminação (LEG-02)          | Fixar o prazo de resposta; ver `runbooks/reclamacoes.md`               |
| Contratos guardados 10 anos (art. 45)                              | Registos de pagamento ficam guardados                                                                 | Confirmar o prazo com o advogado                                       |
| Sistemas de gestão ISO/IEC 20000 e 27001 (art. 45)                 | **Não tem**                                                                                           | Perguntar ao INTIC se é exigido a startups e em que prazo              |
| Comunicar alterações em 15/30 dias (art. 46)                       | —                                                                                                     | Procedimento interno                                                   |
| Iniciar actividade em 3 meses após a licença (art. 49)             | —                                                                                                     | Planear a data do pedido                                               |

## Modelo de requerimento

> Exmo. Senhor Presidente do Conselho de Administração do Instituto Nacional
> de Tecnologias de Informação e Comunicação, IP
>
> **[Nome legal da empresa]**, com sede em **[morada]**, NUIT **[número]**,
> matriculada na Conservatória do Registo das Entidades Legais sob o
> n.º **[número]**, representada por **[nome]**, na qualidade de **[cargo]**,
> vem, nos termos do Regulamento de Registo e Licenciamento de Provedores
> Intermediários de Serviços Electrónicos e de Operadores de Plataformas
> Digitais, aprovado pelo Decreto n.º 59/2023, de 27 de Outubro, e alterado
> pelo Decreto n.º 44/2025, de 28 de Novembro, requerer a V. Exa. **o registo
> e o licenciamento** como Operador de Plataforma Digital, para a plataforma
> **Nhonga** (mercado digital de anúncios classificados), disponível em
> `nhonga.co.mz` e em aplicação móvel.
>
> Junta: formulário, documento de identificação do representante, certidão da
> entidade legal, comprovativo do domínio e documentação técnica.
>
> Pede deferimento.
>
> Maputo, **[data]** — **[assinatura]**

## Perguntas a fazer ao INTIC

1. Classe e taxa aplicáveis a um mercado digital de classificados.
2. O regime de startups dispensa a taxa anual no nosso caso?
3. A ISO/IEC 27001 e 20000 é exigida já ou há prazo de adaptação?
4. Como indicar os IP quando o alojamento é em nuvem, sem ASN próprio?
5. Há restrição a alojar a base de dados na África do Sul?
6. Como se faz a notificação prévia do tratamento de dados pessoais?
7. O que conta como «registo de acesso» para a conservação de 5 anos?

## Fontes

- Regulamento (Decreto n.º 59/2023): <https://intic.gov.mz/wp-content/uploads/2023/06/004_Assinado_REgulamento_RLPISEOPD_27_06_2023.pdf>
- Perguntas frequentes do INTIC (Janeiro de 2026): <https://intic.gov.mz/wp-content/uploads/2026/03/Questoes-sobre-Regulamento-de-Registo-e-Licenciamento-de-Provedores-e-Operadores_Janeiro_2026.pdf>
- Requisitos de licenciamento (25/02/2026): <https://intic.gov.mz/wp-content/uploads/2026/02/Requisitos-de-Licenciamento_25_02_2026_Nova-Versao.pdf>
- Arranque do licenciamento: <https://intic.gov.mz/mocambique-entra-hoje-numa-nova-era-digital-com-o-arranque-do-licenciamento-obrigatorio-de-plataformas-digitais-e-servicos-electronicos/>
