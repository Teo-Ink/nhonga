# 12 — Design visual e cores

**Pontuação: 8/10**

## Resumo

A paleta é OKLCH, ancorada no verde do logótipo (#007A5E) e no amarelo
(#F5C518), com tokens semânticos (`--brand` para texto, `--brand-solid` para
fundos, `--on-brand`, `--danger*`, `--warning*`, `--info*`, `--success*`). É
gerada por `apps/web/scripts/build-tokens.py` e verificada por
`check-contrast.mjs`.

## Contraste WCAG 2.2 AA (calculado)

`node apps/web/scripts/check-contrast.mjs`: **28 pares × 2 temas, todos
passam** (`evidencias/config-diversa.txt`). Exemplos do tema escuro:

- anel de foco 9,17:1;
- estrelas de avaliação 9,00:1;
- contorno de fundo da marca 3,21:1 (mínimo 3:1 para elementos gráficos).

## Achados

### DES-001 — Fotografias de exemplo vindas da Flickr (hotlink)

- Média. O seed e o hero usavam `live.staticflickr.com`. O hero passou a usar
  um WebP local (PERF-01). Em produção, sem modo demo, a CSP (SEC-03) bloqueia
  esse domínio, por isso as fotos de exemplo não podem ir para produção (já
  garantido por CONT-02).

### DES-002 — Valores fixos fora dos tokens

- Baixa. Há cores rgba directas em `globals.css` (por exemplo
  `.herofind__playpause:hover { background: rgba(0,0,0,.55) }`). Aceitável
  para sombras e scrims; registar no design system.

### DES-003 — Legibilidade ao sol

- Informativa. O contraste mínimo do texto é ≥ 4,5:1 nos dois temas. Para uso
  exterior, sugere-se texto do corpo ≥ 7:1 (AAA) nos ecrãs críticos (preço,
  botão de contacto).

## O que está bem

- Tokens semânticos com separação texto/fundo (corrigiu o branco sobre verde
  claro no tema escuro).
- Tipografia Inter (UI) e Ubuntu (títulos), agora self-hosted.
- Ícones de app 180/192/512 e manifest.
