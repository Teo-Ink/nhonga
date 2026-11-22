# 14 — Versão móvel (web e apps iOS/Android)

**Pontuação: 4/10** (a app existe, mas ainda não está pronta para as lojas)

## Abordagem

- **Web responsiva / PWA**: Next.js com navegação inferior, manifest e ícones,
  mas sem service worker (PERF-004).
- **App nativa**: Expo 57 / React Native 0.86 (`apps/mobile`), com Expo Router,
  `expo-secure-store` para o token, `expo-image-picker` para fotos e
  `expo-notifications`. Gerida com npm, fora do workspace pnpm.

## Achados

### MOB-001 — App fora do CI

- Alta · Esforço: S · **Proposto** em `docs/audit/ci/ci.yml.proposta` (job
  `mobile`): `npm ci`, `tsc --noEmit`, `expo lint`, `npm audit --audit-level
high` e `expo-doctor`.

### MOB-002 — Sem identificadores de loja

- Alta · Bloqueia: Sim (publicação)
- Evidência: `app.json` não tem `ios.bundleIdentifier` nem `android.package`
  (`evidencias/config-diversa.txt`).
- Recomendação: `mz.co.nhonga.app` (ou o domínio final) nos dois.

### MOB-003 — A app fala com a API em HTTP

- Alta · Bloqueia: Sim
- Evidência: `src/lib/api.ts:6` (por defeito `http://localhost:3000`);
  `eas.json`, perfil `development`, `http://192.168.100.2:3000`. Os perfis
  `preview` e `production` não definem `EXPO_PUBLIC_API_URL`. O Android 9+
  bloqueia tráfego sem TLS por defeito e o iOS exige HTTPS (ATS).
- Recomendação: `EXPO_PUBLIC_API_URL=https://api.nhonga.co.mz` nos perfis
  `preview` e `production`, depois de OPS-01.

### MOB-004 — Sem eliminação de conta dentro da app

- Alta · Bloqueia: Sim (App Store 5.1.1(v), Google Play). Ver SEC-017.

### MOB-005 — Sem denúncia nem bloqueio na app

- Alta · Bloqueia: Sim (regras de conteúdo gerado por utilizadores: Apple
  1.2, Google Play UGC)
- Evidência: não há "report", "denunciar" nem "bloquear" em `apps/mobile/src`.
  A web tem denúncia; nenhuma das duas tem bloqueio.

### MOB-006 — Sem crash reporting

- Média · ver DEV-002 (Sentry para React Native).

### MOB-007 — Classificação etária e publicidade de apostas

- Alta **[DECISÃO, com jurista]** · ver CONT-03 em `15-conformidade-negocio.md`.
  Anúncios de apostas (1xBet) obrigam a classificação 17+/18+ na App Store e
  às regras da Google Play para jogo, que variam por país.

### MOB-008 — Web mobile

- OK em 360 px (verificado no Chrome headless). Por confirmar:
  - Safari iOS (teclado sobre os campos no login e na publicação);
  - Android Go;
  - upload pela câmara (`capture`) no formulário de publicação.

## O que está bem

- Token em `expo-secure-store` (Keychain/Keystore), com alternativa web
  documentada.
- Expo Router com deep links (`scheme: "nhonga"`), notificações e selecção de
  imagens.
- A API já tem autenticação por token (`Authorization: Bearer`), adequada a
  mobile.
