import { ProductCard } from '../components/ProductCard';
import { ProductRail } from '../components/ProductRail';
import { CategoryCards, type CategoryCard } from '../components/CategoryCards';
import { HomeHero } from '../components/home/HomeHero';
import type { Slide } from '../components/HeroCarousel';
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

export default async function HomePage() {
  const { t } = await getDictionary();

  let products: ProductListItem[] = [];
  let failed = false;
  try {
    products = await listProducts();
  } catch {
    failed = true;
  }

  // Per-category product sets power the Amazon-style landing cards.
  const perCategory = await Promise.all(
    CATEGORY_KEYS.map(async (slug): Promise<CategoryCard> => {
      try {
        const r = await searchProducts({ category: slug });
        return { slug, label: t.categories[slug], items: r.items };
      } catch {
        return { slug, label: t.categories[slug], items: [] };
      }
    }),
  );
  const cards = perCategory.filter((c) => c.items.length > 0);

  const deals = products.filter((p) => p.discountPercent);

  const slides: Slide[] = [
    {
      title: t.home.hero_title,
      subtitle: t.home.hero_subtitle,
      cta: t.home.hero_cta,
      href: '/pesquisa',
    },
    {
      title: t.home.slide2_title,
      subtitle: t.home.slide2_sub,
      cta: t.home.slide2_cta,
      href: '/pesquisa?sort=price_asc',
    },
    {
      title: t.home.slide3_title,
      subtitle: t.home.slide3_sub,
      cta: t.home.slide3_cta,
      href: '/vender/comecar',
    },
  ];

  return (
    <>
      {/* Three-column landing hero: category rail + carousel + account card */}
      <HomeHero t={t} slides={slides} />

      <CategoryCards t={t} cards={cards} />

      <TrustStrip t={t} />

      {failed ? (
        <section className="section">
          <EmptyState icon={<IconBox />}>{t.home.load_error}</EmptyState>
        </section>
      ) : (
        <>
          <ProductRail
            t={t}
            title={t.home.deals}
            items={deals}
            seeAllHref="/pesquisa?sort=price_asc"
          />

          <section className="section" aria-labelledby="feat">
            <div className="section__head">
              <h2 className="section__title" id="feat">
                {t.home.featured}
              </h2>
              <a className="section__link" href="/pesquisa">
                {t.common.see_all} →
              </a>
            </div>
            {products.length === 0 ? (
              <EmptyState icon={<IconBox />}>{t.home.empty}</EmptyState>
            ) : (
              <div className="grid grid--results">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} t={t} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="notice" role="note">
        {t.home.demo_notice}
      </p>
    </>
  );
}
