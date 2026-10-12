# Demo image credits

The storefront's demo catalogue and homepage jumbotron use **real photographs**
as representative product images (a smartphone photo for the phone listing, a
capulana/African-fabric photo for the capulana, etc.). They are **not** photos
of the actual items — this is a demonstration catalogue.

## Source & licensing

All photos were retrieved through the **[Openverse](https://openverse.org) API**
(`api.openverse.org`), filtered to `source=flickr` and
`license_type=commercial`. They are therefore Creative Commons–licensed images
hosted on Flickr (`live.staticflickr.com`), typically **CC BY** or **CC BY-SA**.

- The exact image URLs are the `product_image.url` values in
  [`apps/api/scripts/seed.sql`](../apps/api/scripts/seed.sql) plus the three
  jumbotron images in [`apps/web/app/page.tsx`](../apps/web/app/page.tsx).
- `next.config.mjs` allows remote images; in production this narrows to the
  CloudFront domain.

## Before any public / production deployment

CC BY / BY-SA require **attribution** (creator, title, license, link) wherever
the image is shown. This demo is local and unpublished, so per-image credits are
not yet rendered in the UI. Before going public, either:

1. record each image's creator + license (look up each Flickr URL, or re-query
   Openverse which returns `creator`, `license`, `license_url`), and show the
   credits, **or**
2. replace these with owned/licensed product photography or CC0 images (no
   attribution required).

Nothing here should ship publicly as-is without completing attribution.

## Home hero video

- apps/web/public/hero/market.mp4 — "Aerial View of Busy African Market Street", Pexels
  (https://www.pexels.com/video/aerial-view-of-busy-african-market-street-30339600/), 1280x720.
  Pexels License: free to use, no attribution required. Downloaded and self-hosted (reflects the
  reality of local African/Mozambican street markets).
