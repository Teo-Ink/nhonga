# Lighthouse móvel — 4.ª ronda (22/11/2026)

Lighthouse 12.8.2, `--form-factor=mobile`, throttling simulado (4G lenta,
CPU 4×), build de produção local (`next start`) com a API em modo demo, no
ramo `audit/SEC-10-csp-nonce`.

| Página                        | Performance | Acessibilidade | Boas práticas | SEO  | LCP   | TBT    | CLS |
| ----------------------------- | ----------- | -------------- | ------------- | ---- | ----- | ------ | --- |
| `/`                           | 82          | 100            | 96            | 66\* | 4,5 s | 150 ms | 0   |
| `/categoria/viaturas`         | 91          | 98             | 96            | 69\* | 3,1 s | 180 ms | 0   |
| `/produto/nissan-almera-2013` | 90          | 100            | 96            | 69\* | 3,6 s | 70 ms  | 0   |

\* O SEO baixo é esperado neste ambiente: o modo demo põe
`<meta name="robots" content="noindex">` de propósito. As "boas práticas"
perdem pontos por um 500 do optimizador de imagens, porque este ambiente não
tem acesso à rede externa (fotos de demonstração no Flickr). Nenhum dos dois
acontece em produção.

O LCP da página inicial (4,5 s) é a imagem de destaque; com a CDN dos
estáticos e o domínio, a meta é < 2,5 s. A medição em 3G real num
telemóvel continua por fazer.
