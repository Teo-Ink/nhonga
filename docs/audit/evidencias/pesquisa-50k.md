# Pesquisa com 50 000 anúncios (P1-01)

Base local Postgres 16, 50 000 anúncios, 2 000 lojas, 12 categorias; 25 execuções por consulta através de `CatalogService.listProducts` (`BENCH=1`, `search.bench.db.test.ts`). Critério: p95 < 300 ms.

```
home                   p50  109 ms  p95  143 ms
category               p50   25 ms  p95   31 ms
category + price sort  p50   24 ms  p95   32 ms
price range            p50   34 ms  p95   50 ms
attribute              p50   16 ms  p95   20 ms
search 1 word          p50   65 ms  p95   88 ms
search 2 words         p50   51 ms  p95   70 ms
search accent          p50   47 ms  p95   52 ms
search typo            p50   80 ms  p95  101 ms
search + category      p50   50 ms  p95   69 ms
```

Antes (tudo em memória) não havia paginação em SQL: cada pedido lia todos os anúncios activos.
