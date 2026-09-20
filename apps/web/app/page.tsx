import { ProductCard } from '../components/ProductCard';
import { EmptyState, TrustStrip } from '../components/ui';
import { IconBox } from '../components/icons';
import { listProducts, type ProductListItem } from '../lib/api';
import { getDictionary } from '../lib/i18n/index';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { t } = await getDictionary();

  let products: ProductListItem[] = [];
  let failed = false;
  try {
    products = await listProducts();
  } catch {
    failed = true;
  }

  return (
    <>
      <TrustStrip t={t} />

      <section className="section" aria-labelledby="feat">
        <div className="section__head">
          <h1 className="section__title" id="feat">
            {t.home.featured}
          </h1>
        </div>

        {failed ? (
          <EmptyState icon={<IconBox />}>{t.home.load_error}</EmptyState>
        ) : products.length === 0 ? (
          <EmptyState icon={<IconBox />}>{t.home.empty}</EmptyState>
        ) : (
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} t={t} />
            ))}
          </div>
        )}
      </section>

      <p className="notice" role="note">
        {t.home.demo_notice}
      </p>
    </>
  );
}
