# 06 — Performance

**Pontuação: 4/10 antes; 6/10 com PERF-01**

Contexto: utilizadores em Android de gama baixa ou média, com 3G/4G instável e
dados móveis caros.

## Medições

| Medição                           | Antes                          | Depois (branch)                                   | Como                                                                  |
| --------------------------------- | ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| Peso da home no staging (desktop) | 6 405 KB; 6 147 KB são o vídeo | —                                                 | `performance.getEntriesByType` no staging                             |
| Home num telemóvel de 360 px      | —                              | **304 KB** (API desligada, sem fotos de anúncios) | Chrome headless, build de produção, `evidencias` no commit de PERF-01 |
| Home em desktop                   | —                              | 828 KB (vídeo WebM de 524 KB)                     | idem                                                                  |
| Vídeo                             | 6,1 MB MP4 com áudio           | 0,70 MB MP4, 0,52 MB WebM                         | ffmpeg H.264 CRF 28 e VP9                                             |

Lighthouse e Core Web Vitals em rede real não foram medidos: precisam de
autorização para correr contra o staging. Ver `00-inventario.md`.

## Achados

### PERF-001 — Vídeo de 6 MB em autoplay

- Severidade: Alta · **Estado: corrigido em `audit/PERF-01-video-hero`**.

### PERF-002 — Sem CDN

- Severidade: Média · Esforço: M
- Todo o tráfego vai ao ALB na Cidade do Cabo, incluindo `_next/static`,
  `/hero` e `/api/media`. Recomendação: CloudFront com cache em
  `/_next/static/*`, `/hero/*`, `/icons/*` e `/api/media/*` (já tem
  `max-age=31536000, immutable`), e compressão Brotli.

### PERF-003 — Fotos servidas a partir da BD

- Severidade: Média · ver ARQ-005. Cada foto é lida da BD, convertida de base64
  e reenviada pela BFF. Com CDN à frente, só o primeiro pedido paga.

### PERF-004 — Sem service worker

- Severidade: Baixa · Esforço: M
- O manifest existe, mas não há service worker activo (`sw: n/a` no staging).
  Recomendação: cache do shell e das páginas vistas, e um rascunho de anúncio
  guardado offline (ver UX-004).

### PERF-005 — Pesquisa O(n) em memória

- Severidade: Alta · ver DAT-001.

### PERF-006 — Processamento de imagem síncrono

- Severidade: Baixa. A recodificação com sharp (SEC-007) corre no pedido de
  publicação, até 6 fotos de 1600 px, umas centenas de ms. Aceitável no
  arranque; mover para fila se a publicação ficar lenta.

## O que está bem

- Fontes self-hosted (WEB-03), `display: swap`.
- `next/image` com `localPatterns` e `remotePatterns` restritos.
- Modo "poupar dados" próprio (`data-save-data`) que o vídeo já respeitava.
