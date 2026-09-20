import { notFound } from 'next/navigation';
import { ProductCard } from '../../../components/ProductCard';
import { EmptyState, Rating, VerifiedBadge } from '../../../components/ui';
import { IconBox } from '../../../components/icons';
import { listProductsByVendor } from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Public seller storefront. Reuses the catalogue (?vendor=slug); the header is
// built only from what the catalogue knows about the vendor (name, verified,
// rating) — no invented bio, location or banner imagery.
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getDictionary();

  let items = [] as Awaited<ReturnType<typeof listProductsByVendor>>['items'];
  let vendor = null as Awaited<ReturnType<typeof listProductsByVendor>>['vendor'];
  try {
    const res = await listProductsByVendor(slug);
    items = res.items;
    vendor = res.vendor;
  } catch {
    notFound();
  }

  // No products and no vendor row means the slug matched nothing.
  if (vendor === null && items.length === 0) {
    return (
      <div className="empty" role="status">
        <h1 className="section__title">{t.seller.not_found_title}</h1>
        <p>{t.seller.not_found_body}</p>
        <a className="btn btn--cta" href="/" style={{ maxWidth: 220 }}>
          {t.common.brand}
        </a>
      </div>
    );
  }

  const name = vendor?.displayName ?? slug;
  const count = items.length;
  const countLabel =
    count === 1 ? t.seller.one_product : t.seller.n_products.replace('{n}', String(count));

  return (
    <>
      <header className="store">
        <span className="store__avatar" aria-hidden="true">
          {name.charAt(0)}
        </span>
        <div className="store__meta">
          <h1 className="store__name">
            {name}
            {vendor?.isVerified ? <VerifiedBadge label={t.seller.verified} /> : null}
          </h1>
          <div className="store__stats">
            {vendor && vendor.ratingAvg !== null ? (
              <Rating value={vendor.ratingAvg} count={vendor.ratingCount} />
            ) : null}
            <span className="store__count">{countLabel}</span>
          </div>
        </div>
      </header>

      <section className="section" aria-label={t.seller.products}>
        {count === 0 ? (
          <EmptyState icon={<IconBox />}>{t.seller.no_products}</EmptyState>
        ) : (
          <div className="grid">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} t={t} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
