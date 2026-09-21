import { ProductCard } from '../components/ProductCard';
import { ProductRail } from '../components/ProductRail';
import { EmptyState, TrustStrip } from '../components/ui';
import {
  IconBox,
  IconShirt,
  IconDevice,
  IconPhone,
  IconHome,
  IconCup,
  IconSparkle,
} from '../components/icons';
import { listProducts, type ProductListItem } from '../lib/api';
import { getDictionary } from '../lib/i18n/index';

export const dynamic = 'force-dynamic';

const CATEGORY_TILES = [
  { slug: 'moda', Icon: IconShirt },
  { slug: 'electronica', Icon: IconDevice },
  { slug: 'telemoveis', Icon: IconPhone },
  { slug: 'casa', Icon: IconHome },
  { slug: 'alimentacao', Icon: IconCup },
  { slug: 'beleza', Icon: IconSparkle },
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

  const deals = products.filter((p) => p.discountPercent);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero__content">
          <h1 className="hero__title">{t.home.hero_title}</h1>
          <p className="hero__subtitle">{t.home.hero_subtitle}</p>
          <div className="hero__actions">
            <a className="btn btn--cta" href="/pesquisa">
              {t.home.hero_cta}
            </a>
            <a className="btn btn--ghost hero__sell" href="/vender/comecar">
              {t.home.hero_sell}
            </a>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="section" aria-labelledby="cats">
        <div className="section__head">
          <h2 className="section__title" id="cats">
            {t.home.shop_by_category}
          </h2>
        </div>
        <div className="cattiles">
          {CATEGORY_TILES.map(({ slug, Icon }) => (
            <a className="cattile" key={slug} href={`/categoria/${slug}`}>
              <span className="cattile__icon" aria-hidden="true">
                <Icon width={26} height={26} />
              </span>
              <span className="cattile__label">{t.categories[slug]}</span>
            </a>
          ))}
        </div>
      </section>

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
