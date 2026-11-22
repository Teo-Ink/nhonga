# 11 — UI/UX e usabilidade

**Pontuação: 6/10**

Referências: OLX Brasil e OLX Portugal. Avaliação heurística (Nielsen) dos
fluxos principais, feita no staging e no código.

## Achados

### UX-001 — Promessas de marketplace num site de classificados

- Alta · Bloqueia: Sim · **Estado: flag em `audit/CONT-01-promessas-flag`**
  **[DECISÃO de modelo]**
- Heurística "correspondência com o mundo real". A home prometia protecção
  com reembolso, entrega com seguimento e pagamento na entrega, que a
  plataforma não oferece. A dica de segurança do painel dizia "combina sempre
  dentro do Nhonga, desconfia do WhatsApp", mas o botão principal do anúncio é
  WhatsApp.

### UX-002 — Mistura de "tu" e "você"

- Média · Esforço: S
- Evidência: a API usa "Inicia sessão", "Paga com", "Tens pagamentos…
  Termina-os", "Tenta de novo" (`checkout.service.ts:104,119,162,216`,
  `wallet.service.ts:81`). A web usa "Pague com", "Inicie sessão", "Tente
  novamente" (`lib/i18n/pt.ts:12,116,360`).
- Recomendação: escolher um registo, "você" (formal, recomendado para pt-MZ
  em serviços), e passar as mensagens da API para códigos traduzidos na web.

### UX-003 — Publicar sem conta e localização do vendedor

- Média · ver SEC-010 e DAT-003. Na OLX, o anúncio pede a localização (cidade
  e bairro) em cada publicação e pede login no fim do formulário; aqui a
  localização vem da loja.

### UX-004 — Ligação perdida a meio da publicação

- Média · Esforço: M. `app/vender/novo/page.tsx` (509 linhas) guarda o estado
  só em memória: se a página recarregar ou a rede falhar, perdem-se o texto e
  as fotos. Recomendação: rascunho em `localStorage` (ou IndexedDB para as
  fotos), reenvio com `Idempotency-Key` (API-004) e uma mensagem clara de "sem
  ligação, tentamos de novo".

### UX-005 — Erros quando a API falha

- **Feito** em WEB-01: as rotas devolvem 503 com mensagem em português em vez
  de 500. Falta mostrar essa mensagem nos componentes que hoje mostram
  "Erro".

### UX-006 — Confiança

- Positivo: selo "Verificado", "Loja Pro", avaliações, botão de denunciar,
  dicas de segurança no anúncio.
- Em falta: bloquear utilizador (SEC-015), "membro desde" e tempo de resposta
  do vendedor.

## Comparação rápida com a OLX

| Aspecto                   | OLX BR/PT                                       | Nhonga                                                              | Nota                                  |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| Publicar em poucos passos | 1 formulário, login no fim                      | 1 formulário; plano de destaque no fim; publicação anónima possível | Bom, mas exigir sessão (SEC-010)      |
| Pesquisa e filtros        | texto, categoria, preço, localização, atributos | igual, mais pesquisa por IA                                         | Relevância ainda em memória (DAT-001) |
| Página do anúncio         | galeria, preço, localização, vendedor, contacto | igual, mais WhatsApp                                                | Bom                                   |
| Favoritos e alertas       | sim                                             | sim (pesquisas guardadas com SMS)                                   | Bom                                   |
| Contacto                  | chat interno                                    | chat interno + WhatsApp                                             | Bom                                   |

## O que está bem

- Português de Moçambique na maioria dos textos, preços em MT bem formatados
  (`45.000 MT`).
- Navegação inferior em mobile, tema claro e escuro, modo "poupar dados".
- Estados vazios e "a carregar" nos componentes principais.
