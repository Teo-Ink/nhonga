import { ProductCard } from '../components/ProductCard';
import { ProductRail } from '../components/ProductRail';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { PostAdBanner } from '../components/home/PostAdBanner';
import { HeroCarousel, type Slide } from '../components/HeroCarousel';
import { EmptyState, TrustStrip } from '../components/ui';
import { IconBox } from '../components/icons';
import { listProducts, searchProducts, type ProductListItem } from '../lib/api';
import { getDictionary } from '../lib/i18n/index';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// Classifieds home (OLX-structured, Nhonga's brand): category strip, a hero
// carousel jumbotron, a post-a-free-ad banner, category listing rows, and a
// recent-ads grid.
export default async function HomePage() {
  const { t } = await getDictionary();

  let products: ProductListItem[] = [];
  let failed = false;
  try {
    products = await listProducts();
  } catch {
    failed = true;
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

  const recent = [...products].sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });

  const slides: Slide[] = [
    {
      title: t.home.hero_title,
      subtitle: t.home.hero_subtitle,
      cta: t.home.hero_cta,
      href: '/pesquisa',
      image: 'https://live.staticflickr.com/2680/4277873044_9680cb5df3_b.jpg',
    },
    {
      title: t.home.slide2_title,
      subtitle: t.home.slide2_sub,
      cta: t.home.slide2_cta,
      href: '/pesquisa?sort=price_asc',
      image: 'https://live.staticflickr.com/671/21135682726_f8f6da6372_b.jpg',
    },
    {
      title: t.home.slide3_title,
      subtitle: t.home.slide3_sub,
      cta: t.home.slide3_cta,
      href: '/vender/novo',
      image: 'https://live.staticflickr.com/6083/6149598235_7ff5ee3354_b.jpg',
    },
  ];

  return (
    <>
      <CategoryStrip t={t} />

      {/* Jumbotron */}
      <HeroCarousel
        slides={slides}
        prevLabel={t.home.carousel_prev}
        nextLabel={t.home.carousel_next}
        gotoLabel={t.home.carousel_goto}
      />

      <PostAdBanner t={t} />

      {failed ? (
        <section className="section">
          <EmptyState icon={<IconBox />}>{t.home.load_error}</EmptyState>
        </section>
      ) : (
        <>
          {/* Category listing rows (horizontal, OLX-style) */}
          {rows.map((row) => (
            <ProductRail
              key={row.slug}
              t={t}
              title={row.label}
              items={row.items}
              seeAllHref={`/categoria/${row.slug}`}
            />
          ))}

          {/* Recent ads grid */}
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
        </>
      )}

      <TrustStrip t={t} />

      <p className="notice" role="note">
        {t.home.demo_notice}
      </p>
    </>
  );
}
