# Auditoria pré-produção (24/11/2026)

Feita sobre a cabeça da cadeia (`audit/LEG-01-conformidade-legal`), num
ambiente local: API e site compilados em modo de produção, Postgres 16, dados
de demonstração e uma base de 50 000 anúncios para a carga. **Nada foi testado
contra o staging nem contra produção.** As correcções estão no ramo
`audit/PRE-01-pre-producao`.

## Veredicto

**O site e a API ficam prontos para um piloto fechado** depois de a cadeia
entrar no `main` e de a produção ser criada. **Não estão prontos para
lançamento aberto** enquanto os pontos da secção "O que falta" não estiverem
feitos. **A app móvel não está pronta**: compila e gera o pacote, mas nunca
correu num telemóvel.

Esta auditoria encontrou três problemas que teriam afectado o lançamento e
que os testes anteriores não apanhavam. Estão corrigidos e com testes.

## Achados e correcções

| ID      | Gravidade | O que era                                                                                                                                                                                                                                                                                                                                                                            | Correcção                                                                                                                                                                                                                           |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRE-02  | **Alta**  | O site chama a API a partir dos seus servidores, por isso a API via todos os visitantes como um único endereço. Os limites "por visitante" eram uma quota única para o site inteiro: **30 inícios de sessão por hora**, 5 reclamações, 10 denúncias. O limitador do site lia o primeiro valor de `X-Forwarded-For`, que o cliente controla, o que deixava contornar o limite de SMS. | O site passa o endereço real do visitante à API (o valor acrescentado pelo balanceador, contado da direita; `TRUSTED_PROXY_HOPS`). Testado: um visitante esgota o seu limite sem afectar outro, e falsificar o cabeçalho não ajuda. |
| PRIV-01 | **Alta**  | O número de telefone do vendedor ia no HTML e no JSON público de cada anúncio e loja. Qualquer pessoa podia recolher todos os números; a Política de Privacidade dizia que só eram mostrados a pedido.                                                                                                                                                                               | As páginas só sabem que canais o vendedor oferece. Os dígitos vêm de `POST /catalog/contacts`, a pedido, com limite de 30 por hora por visitante. Site e app actualizados.                                                          |
| PRE-05  | **Média** | Com 50 000 anúncios, a lista da página inicial custava ~120 ms de base de dados e a API servia **20 pedidos por segundo**; as sugestões de pesquisa faziam uma leitura completa (250 ms).                                                                                                                                                                                            | Cache de 15 s para listas, sugestões e contadores públicos (limpa em cada alteração de anúncio) e sugestões com o índice de pesquisa. Ver números abaixo.                                                                           |
| PRE-01  | Baixa     | Um id inválido no URL dava erro 500 (avaliações, promoções, subscrições, alertas), o que sujaria os alarmes.                                                                                                                                                                                                                                                                         | Passa a 404.                                                                                                                                                                                                                        |
| PRE-03  | Baixa     | Um pedido de escrita vindo de outro site só era travado pelo cookie `SameSite=Lax`.                                                                                                                                                                                                                                                                                                  | O site recusa (403) escritas com `Origin` de outro site.                                                                                                                                                                            |
| PRE-04  | Baixa     | A imagem principal da página inicial só era descoberta depois do CSS.                                                                                                                                                                                                                                                                                                                | Pré-carregada com prioridade. LCP 4,6 s → 3,9 s (simulação 4G lenta).                                                                                                                                                               |

## Segurança — 60 verificações activas

55 passam. As 5 restantes são falsos alarmes do meu guião (respostas vazias
a visitantes sem sessão; bloqueio por outra regra).

- **Acesso a dados de outros:** editar, arquivar ou apagar o anúncio de outra
  pessoa, ler ou escrever na conversa de outros, ver ou aprovar o pagamento
  de outra loja, promover o anúncio de outro: tudo recusado (403/404).
- **Dinheiro:** carregar a carteira sem pagar é recusado; um aviso de
  pagamento falsificado não marca nada como pago (a API confirma sempre o
  estado junto do prestador); repetir um pedido com a mesma chave devolve o
  mesmo pagamento; a mesma chave com outro valor é recusada; o crédito entra
  uma só vez.
- **Sessão e códigos:** o código SMS é de uso único e bloqueia após tentativas
  erradas; terminar sessão e eliminar a conta invalidam o token; o cookie é
  `HttpOnly` e `SameSite=Lax`.
- **Entrada e erros:** corpo acima do limite → 413; JSON inválido → 400;
  metacaracteres SQL na pesquisa não têm efeito; HTML e scripts no título de
  um anúncio saem escapados; os erros não revelam pilhas nem SQL.
- **Operação:** os endpoints de administração respondem 404 sem o token certo;
  a API recusa arrancar em produção com SMS ou pagamentos simulados, sem CORS
  ou sem tecto do assistente.
- **Cabeçalhos:** CSP com nonce e `strict-dynamic`, HSTS atrás de HTTPS,
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Registos:** nenhum número de telefone, código ou token nos registos da API.
- **Dependências:** nenhuma vulnerabilidade alta ou crítica (1 moderada em
  ferramentas de desenvolvimento; 3 moderadas na cadeia do Expo). Nenhum
  segredo no repositório.

## Performance

API, 30 ligações em simultâneo, base com 50 000 anúncios, máquina de 2 CPU
partilhada com a base de dados (números indicativos, não de produção):

| Rota               | Antes                     | Depois                                     |
| ------------------ | ------------------------- | ------------------------------------------ |
| Lista inicial      | 20 pedidos/s, p50 1,5 s   | 2 700 pedidos/s, p50 9 ms                  |
| Pesquisa "toyota"  | 27 pedidos/s, p50 1,2 s   | 3 200 pedidos/s, p50 8 ms (repetida)       |
| Categoria          | 116 pedidos/s, p50 258 ms | 3 300 pedidos/s, p50 7 ms                  |
| Sugestões          | 47 pedidos/s, p50 664 ms  | 3 900 pedidos/s, p50 5 ms; 22 ms sem cache |
| Detalhe de anúncio | 547 pedidos/s, p50 53 ms  | igual                                      |

**Limite que fica:** o site gera cada página no servidor. Nesta máquina serve
27 a 45 páginas por segundo (p50 ~1 s com 30 pessoas em simultâneo). Chega
para um piloto. Para tráfego aberto é preciso medir em produção e, se
necessário, pôr cache de páginas anónimas na CDN ou mais tarefas.

Lighthouse móvel (4G lenta simulada): desempenho 83 a 94 nas páginas
interiores, 87 na inicial depois da correcção; acessibilidade 98 a 100; CLS 0;
~400 a 500 KB por página.

## Acessibilidade e design

- Os testes automáticos (axe, WCAG 2.1 AA) passam nas páginas cobertas.
- Lighthouse aponta a ordem dos títulos nas páginas de categoria e de
  pesquisa (os cartões saltam um nível). Não impede o uso; fica por corrigir.
- **Por fazer, e não é automatizável:** leitor de ecrã num Android real e
  teste com utilizadores em telemóveis fracos.

## Arquitectura e base do código

- Build, tipos, lint, fronteiras entre módulos, contrato OpenAPI e Prettier
  verdes. Testes: API 207 (1 ignorado), site 25, partilhado 145, app 3,
  ponta a ponta 20/20.
- As 27 migrações aplicam numa base vazia em menos de 1 s.
- **Risco:** o CI actual do `main` não corre os testes com base de dados nem
  os de ponta a ponta (41 testes ficam ignorados). As propostas em
  `docs/audit/ci/` resolvem isso e continuam por mover.

## App móvel

- Tipos e testes passam; o pacote JavaScript gera para Android (3,5 MB) e
  iOS (3,1 MB), o que confirma que a actualização para o SDK 58 compila.
- O token de sessão fica no armazenamento seguro do telemóvel.
- **Não verificado:** build nativa (EAS), execução num telemóvel, notificações,
  câmara, comportamento em rede lenta. `expo-doctor` passou 18 de 20
  verificações; as 2 restantes precisam de Internet.

## Infraestrutura

Não foi possível validar o Terraform aqui. Revisão por leitura: produção com
base de dados em duas zonas, 2 tarefas por serviço com escalonamento
automático, WAF, segredos fora do estado. **O primeiro `apply` de produção é
o verdadeiro teste** e deve ser feito com tempo.

## O que falta antes do piloto

| #   | O quê                                                                   | Quem              |
| --- | ----------------------------------------------------------------------- | ----------------- |
| 1   | Juntar a cadeia (PRs #21 a #48 e este ramo) ao `main`                   | Dono              |
| 2   | Mover as propostas de CI (testes com base de dados, ponta a ponta, app) | Dono              |
| 3   | Domínio, HTTPS e primeiro `apply` de produção                           | Dono + engenharia |
| 4   | Teste de pagamento real de valor baixo (PawaPay) e de SMS real          | Dono + engenharia |
| 5   | Ensaio de restauro da base de dados                                     | Dono + engenharia |
| 6   | Sentry e subscrição dos alarmes                                         | Dono              |
| 7   | Registo no INTIC e textos legais aprovados                              | Dono + advogado   |

## Antes do lançamento aberto

- Teste de carga no staging (com autorização) e medição em 3G real.
- WAF em modo de bloqueio, depois de duas semanas sem falsos positivos.
- Primeira build da app em telemóveis reais; contas e revisão das lojas.
- Assinatura dos avisos da PawaPay (hoje um aviso falso só provoca uma
  consulta ao prestador; o risco é baixo).
- Ordem dos títulos nas páginas de lista.
