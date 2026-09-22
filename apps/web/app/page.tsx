import { ProductCard } from '../components/ProductCard';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { PostAdBanner } from '../components/home/PostAdBanner';
import { EmptyState, TrustStrip } from '../components/ui';
import { IconBox } from '../components/icons';
import { listProducts, type ProductListItem } from '../lib/api';
import { getDictionary } from '../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Classifieds-style home (OLX-structured, Nhonga's brand): a round category
// strip, a post-a-free-ad banner, then a grid of recent listings (newest first).
export default async function HomePage() {
  const { t } = await getDictionary();

  let products: ProductListItem[] = [];
  let failed = false;
  try {
    products = await listProducts();
  } catch {
    failed = true;
  }

  // Newest first, mirroring a classifieds "recent ads" feed.
  const recent = [...products].sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });

  return (
    <>
      <CategoryStrip t={t} />

      <PostAdBanner t={t} />

      <section className="section" aria-labelledby="recent">
        <div className="section__head">
          <h1 className="section__title" id="recent">
            {t.home.recent_title}
          </h1>
          <a className="section__link" href="/pesquisa?sort=newest">
            {t.common.see_all} →
          </a>
        </div>

        {failed ? (
          <EmptyState icon={<IconBox />}>{t.home.load_error}</EmptyState>
        ) : recent.length === 0 ? (
          <EmptyState icon={<IconBox />}>{t.home.empty}</EmptyState>
        ) : (
          <div className="grid grid--listings">
            {recent.map((p) => (
              <ProductCard key={p.id} p={p} t={t} />
            ))}
          </div>
        )}
      </section>

      <TrustStrip t={t} />

      <p className="notice" role="note">
        {t.home.demo_notice}
      </p>
    </>
  );
}
