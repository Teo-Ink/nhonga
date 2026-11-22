# 15 — Conformidade, conteúdo e negócio

**Pontuação: 4/10.** A maior parte precisa de validação jurídica.

> Nada neste documento é parecer jurídico. Os pontos marcados **[jurista]**
> precisam de validação por um advogado em Moçambique.

## Achados

### CMP-001 — Modelo: classificados ou marketplace transaccional

- Alta · Bloqueia: Sim **[DECISÃO]**
- O texto prometia garantias de marketplace (UX-001). A flag de CONT-01
  esconde essas promessas até haver decisão. A escolha define:
  - os termos;
  - a responsabilidade por entregas e reembolsos;
  - o licenciamento de pagamentos;
  - o fluxo de encomendas legado (PAG-006).

### CMP-002 — Publicidade de apostas (1xBet)

- Alta **[DECISÃO, jurista]**
- Riscos:
  - regulamentação moçambicana de jogos de fortuna e azar e de publicidade
    (confirmar a entidade competente e a licença do anunciante);
  - restrição de idade (os anúncios não devem aparecer a menores; não há
    verificação de idade);
  - regras das lojas de apps (classificação etária, conteúdo de jogo, países).
- Recomendação provisória:
  - só aceitar anunciantes de jogo com licença em Moçambique;
  - categoria de anúncio "18+" que não aparece em contas sem idade declarada;
  - não mostrar na app mobile até haver decisão.
- A maqueta 1xBet continua só local (`public/spec` no `.gitignore`).

### CMP-003 — Termos, privacidade e cookies

- Alta · Bloqueia: Sim **[jurista]**
- Evidência: `app/termos/page.tsx` e `app/privacidade/page.tsx` têm
  marcadores (`[Confirmar política de reembolso e prazos com o advogado.]`). Não
  há política de cookies, embora só sejam usados cookies essenciais (sessão,
  idioma, tema).
- Recomendação: rever com o advogado face à Lei n.º 3/2017 (Transacções
  Electrónicas) e à legislação de defesa do consumidor; notificar o INTIC se
  aplicável; publicar as regras de publicação e a lista de artigos proibidos.

### CMP-004 — SEO e partilha

- **Feito** em `audit/WEB-02-seo-partilha`:
  - `robots.txt` (bloqueia tudo fora de produção);
  - `sitemap.xml`;
  - Open Graph e Twitter por defeito, por anúncio, categoria e loja;
  - JSON-LD Product/Offer em MZN;
  - URLs canónicas.
- Falta configurar `SITE_URL` e `SITE_INDEXABLE=1` na produção.

### CMP-005 — Métricas de produto

- Média. Há eventos de visualização e contacto (`/api/track`,
  `products/:id/events`), mas não há um funil definido (pesquisa → anúncio →
  contacto; início → fim de publicação). Recomendação: definir 5 métricas
  norte e um painel (por exemplo, Plausible self-hosted, ou tabelas próprias +
  Metabase).

### CMP-006 — Idiomas

- OK: português (principal) e inglês com o mesmo formato de dicionário.
  Preparado para mais línguas (changana, macua) ao nível do dicionário.

### CMP-007 — Eliminação de conta e direitos do titular

- Alta · ver SEC-017. Também é exigido pelas lojas de apps (MOB-004).
