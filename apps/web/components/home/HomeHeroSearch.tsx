import { preload } from 'react-dom';
import type { Dictionary } from '../../lib/i18n/index';
import type { District, Province } from '../../lib/api';
import { HeroVideo } from './HeroVideo';
import { SearchBox } from '../search/SearchBox';

// Fiverr-structured hero (Nhonga's own brand, no Fiverr assets/colours/copy): a
// bold headline, one prominent centred search, and "Popular:" quick links. The
// search is a plain GET form → /pesquisa, so it needs no client JS.
const POPULAR = ['viaturas', 'imoveis', 'empregos', 'servicos', 'telemoveis', 'eventos'] as const;

export function HomeHeroSearch({
  t,
  provinces = [],
  districts = [],
}: {
  t: Dictionary;
  provinces?: Province[];
  districts?: District[];
}) {
  // The hero still is the largest thing on the phone screen (LCP) but it is a
  // CSS background, which the browser only discovers after the stylesheet.
  // Preloading it starts the download with the HTML (PRE-04).
  preload('/hero/market-poster.webp', { as: 'image', fetchPriority: 'high' });
  return (
    <section className="herofind" aria-label={t.home.search_title}>
      {/* Mozambique-reality still (Maputo municipal market). Sits under the video
          on desktop; on phones the video is hidden by CSS and this shows instead,
          so the hero is never a flat colour — one light image, not a 6MB loop. */}
      <span
        className="herofind__photo"
        aria-hidden="true"
        style={{
          // Local still (a frame of the hero video, ~75 KB WebP) instead of a
          // hotlinked photo: works under the CSP and costs little on mobile.
          backgroundImage: 'url("/hero/market-poster.webp")',
        }}
      />
      <HeroVideo
        src="/hero/market.mp4"
        webmSrc="/hero/market.webm"
        poster="/hero/market-poster.webp"
        pauseLabel={t.home.hero_pause}
        playLabel={t.home.hero_play}
      />
      <div className="herofind__inner">
        <h1 className="herofind__title">{t.home.search_title}</h1>
        <p className="herofind__sub">{t.home.search_sub}</p>

        <SearchBox
          placeholder={t.home.search_ph}
          categories={Object.entries(t.categories).map(([slug, label]) => ({ slug, label }))}
          variant="hero"
          submitLabel={t.home.search_btn}
          provinces={provinces}
          districts={districts}
          location={{
            all: t.search.all_country,
            whole_region: t.search.whole_region,
            choose_district: t.search.choose_district,
            back: t.search.back,
          }}
          tools={{
            voice: t.common.search_voice,
            image: t.common.search_image,
            listening: t.common.search_listening,
            thinking: t.common.search_thinking,
            unsupported: t.common.search_voice_unsupported,
            error: t.common.search_ai_error,
            unconfigured: t.common.search_ai_unconfigured,
          }}
        />

        <div className="herofind__popular">
          <span className="herofind__poplabel">{t.home.popular}</span>
          {POPULAR.map((k) => (
            <a key={k} className="herofind__chip" href={`/categoria/${k}`}>
              {t.categories[k]}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
