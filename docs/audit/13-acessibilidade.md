# 13 — Acessibilidade (WCAG 2.1 AA)

**Pontuação: 6/10** (auditoria parcial: sem TalkBack/VoiceOver real)

## Achados

### ACC-001 — Contraste

- OK: 28 pares × 2 temas passam AA (ver `12-design-cores.md`).

### ACC-002 — Texto alternativo

- Na visita de 22/11/2026, 0 de 37 imagens da home estavam sem `alt`
  (`evidencias/staging-22-11-2026.md`). A observação anterior de 4 imagens sem
  `alt` não se reproduziu; podem ter sido banners de publicidade servidos
  nessa altura. Garantir `alt` obrigatório no formulário de anúncios
  publicitários.

### ACC-003 — Alvos de toque pequenos

- Média · Esforço: S. O botão de pausa do vídeo tem 34 × 34 px
  (`globals.css:6731-6732`). O mínimo recomendado é 44 × 44 (WCAG 2.5.5,
  Material 48 dp). Rever os ícones do cabeçalho e os chips de filtros.

### ACC-004 — Movimento

- **Feito** em PERF-01: o vídeo não arranca com `prefers-reduced-motion`.

### ACC-005 — Por verificar

- Navegação completa por teclado no formulário de publicação e nos modais
  (carteira, denúncia).
- Ordem de foco e foco preso nos diálogos.
- Leitura com TalkBack em Android de gama baixa.
- Zoom a 200% sem perder conteúdo.
- Proposta: `@axe-core/playwright` nos E2E (TST-003).

## O que está bem

- `lang="pt"`, `aria-label` nos controlos só com ícone, anel de foco com
  contraste alto, labels nos campos de login.
