import type { Dictionary } from '../../lib/i18n/index';
import { IconSearch } from '../icons';
import { HeroVideo } from './HeroVideo';

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

        <form className="herofind__search" role="search" action="/pesquisa" method="get">
          <IconSearch width={22} height={22} aria-hidden />
          <label htmlFor="hq" className="sr-only">
            {t.home.search_ph}
          </label>
          <input id="hq" name="q" placeholder={t.home.search_ph} autoComplete="off" />
          <button type="submit" className="btn btn--cta herofind__btn">
            {t.home.search_btn}
          </button>
        </form>

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
