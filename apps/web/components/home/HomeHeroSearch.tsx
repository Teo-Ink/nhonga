import type { Dictionary } from '../../lib/i18n/index';
import { HeroVideo } from './HeroVideo';
import { SearchBox } from '../search/SearchBox';

// Fiverr-structured hero (Nhonga's own brand, no Fiverr assets/colours/copy): a
// bold headline, one prominent centred search, and "Popular:" quick links. The
// search is a plain GET form → /pesquisa, so it needs no client JS.
const POPULAR = ['viaturas', 'imoveis', 'empregos', 'servicos', 'telemoveis', 'eventos'] as const;

export function HomeHeroSearch({ t }: { t: Dictionary }) {
  return (
    <section className="herofind" aria-label={t.home.search_title}>
      {/* Mozambique-reality still (Maputo municipal market). Sits under the video
          on desktop; on phones the video is hidden by CSS and this shows instead,
          so the hero is never a flat colour — one light image, not a 6MB loop. */}
      <span
        className="herofind__photo"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("https://live.staticflickr.com/2618/3858546840_da8a76b450_b.jpg")',
        }}
      />
      <HeroVideo src="/hero/market.mp4" pauseLabel={t.home.hero_pause} playLabel={t.home.hero_play} />
      <div className="herofind__inner">
        <h1 className="herofind__title">{t.home.search_title}</h1>
        <p className="herofind__sub">{t.home.search_sub}</p>

        <SearchBox
          placeholder={t.home.search_ph}
          categories={Object.entries(t.categories).map(([slug, label]) => ({ slug, label }))}
          variant="hero"
          submitLabel={t.home.search_btn}
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
