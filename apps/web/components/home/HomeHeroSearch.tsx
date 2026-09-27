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
