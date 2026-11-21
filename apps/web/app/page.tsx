import { ProductCard } from '../components/ProductCard';
import { ProductRail } from '../components/ProductRail';
import { AdSlot } from '../components/AdSlot';
import { PostAdBanner } from '../components/home/PostAdBanner';
import { AppPromo } from '../components/home/AppPromo';
import { HomeHeroSearch } from '../components/home/HomeHeroSearch';
import { PopularCategories } from '../components/home/PopularCategories';
import { RecentlyViewed } from '../components/RecentlyViewed';
import { HowItWorks } from '../components/home/HowItWorks';
import { StatStrip } from '../components/home/StatStrip';
import { EmptyState, TrustStrip } from '../components/ui';
import { IconBox } from '../components/icons';
import {
  getDistricts,
  getHomeStats,
  getProvinces,
  listProducts,
  searchProducts,
  type District,
  type HomeStats,
  type ProductListItem,
  type Province,
} from '../lib/api';
import { getDictionary } from '../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Category rows on the home: the four verticals people come to a classifieds
// site for. Every other category is one tap away in the slider and the nav —
// eleven rows made the page ~7,400px tall on desktop.
const CATEGORY_KEYS = ['viaturas', 'imoveis', 'telemoveis', 'empregos'] as const;

// OLX-structured home in Nhonga's brand: search first, categories, the newest
// listings (freshness is what brings people back), a few category rows, then
// "how it works" and the sell prompt. One leaderboard ad slot, above the
// categories (the highest-visibility position on the page).
export default async function HomePage() {
  const { t } = await getDictionary();

  let products: ProductListItem[] = [];
  let failed = false;
  try {
    products = await listProducts();
  } catch {
    failed = true;
  }

  let stats: HomeStats | null = null;
  try {
    stats = await getHomeStats();
  } catch {
    stats = null;
  }

  let provinces: Province[] = [];
  let districts: District[] = [];
  try {
    [provinces, districts] = await Promise.all([getProvinces(), getDistricts()]);
  } catch {
    provinces = [];
    districts = [];
  }

  const perCategory = await Promise.all(
    CATEGORY_KEYS.map(async (slug) => {
      try {
        const r = await searchProducts({ category: slug, sort: 'newest' });
        return { slug, label: t.categories[slug], items: r.items };
      } catch {
        return { slug, label: t.categories[slug], items: [] as ProductListItem[] };
      }
    }),
  );
  const rows = perCategory.filter((c) => c.items.length > 0);

  const recent = [...products]
    .sort((a, b) => {
      const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
      const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
      return tb - ta;
    })
    // Keep the home light: show the 12 newest, with "ver todos" → /pesquisa.
    .slice(0, 12);

  return (
    <>
      <HomeHeroSearch t={t} provinces={provinces} districts={districts} />

      {stats ? <StatStrip stats={stats} t={t.home} /> : null}

      {/* Premium leaderboard: the first thing under the search, before the
          categories — the home's main display-ad inventory. Serves the booked
          campaign; with none live it shows the "advertise here" promo. */}
      <section className="section section--ad">
        <AdSlot t={t} placement="leaderboard" />
      </section>

      <PopularCategories t={t} />

      <RecentlyViewed title={t.home.recent_viewed} />

      {failed ? (
        <section className="section">
          <EmptyState icon={<IconBox />}>{t.home.load_error}</EmptyState>
        </section>
      ) : (
        <>
          <section className="section" aria-labelledby="recent">
            <div className="section__head">
              <h2 className="section__title" id="recent">
                {t.home.recent_title}
              </h2>
              <a className="section__link" href="/pesquisa?sort=newest">
                {t.common.see_all} →
              </a>
            </div>
            <div className="grid grid--listings">
              {recent.map((p) => (
                <ProductCard key={p.id} p={p} t={t} />
              ))}
            </div>
          </section>

          {rows.map((row) => (
            <ProductRail
              key={row.slug}
              t={t}
              title={row.label}
              items={row.items}
              seeAllHref={`/categoria/${row.slug}`}
            />
          ))}
        </>
      )}

      <PostAdBanner t={t} />

      <HowItWorks t={t} />

      <AppPromo t={t} />

      <TrustStrip t={t} />

      <p className="notice" role="note">
        {t.home.demo_notice}
      </p>
    </>
  );
}
