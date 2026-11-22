# E2E e acessibilidade (TEST-01, P2-09)

Playwright 1.65, Chrome, viewport 360×780, API e web reais com Postgres e catálogo de demonstração. Três execuções seguidas em 22/11/2026:

```
  ✓   1 [mobile-360] › tests/a11y.spec.ts:15:3 › accessibility: /
  ✓   2 [mobile-360] › tests/a11y.spec.ts:15:3 › accessibility: /categoria/viaturas
  ✓   3 [mobile-360] › tests/a11y.spec.ts:15:3 › accessibility: /produto/nissan-almera-2013
  ✓   4 [mobile-360] › tests/a11y.spec.ts:15:3 › accessibility: /entrar
  ✓   5 [mobile-360] › tests/a11y.spec.ts:15:3 › accessibility: /vender/novo
  ✓   6 [mobile-360] › tests/account.spec.ts:5:1 › sign in with a phone number and see the account
  ✓   7 [mobile-360] › tests/account.spec.ts:13:1 › publish a listing: sign in at the end, the draft survives
  ✓   8 [mobile-360] › tests/account.spec.ts:37:1 › message a seller from a listing
  ✓   9 [mobile-360] › tests/account.spec.ts:61:1 › delete my account
  ✓  10 [mobile-360] › tests/browse.spec.ts:4:1 › search from the home page and open a listing
  ✓  11 [mobile-360] › tests/browse.spec.ts:21:1 › browse a category and sort by lowest price
  ✓  12 [mobile-360] › tests/browse.spec.ts:38:1 › report a suspicious listing
  12 passed
```

axe-core 4.11 (WCAG 2.0/2.1 A e AA): zero violações sérias ou críticas em `/`, `/categoria/viaturas`, `/produto/…`, `/entrar`, `/vender/novo`, depois das correcções de contraste do ramo TEST-01.
