import { ShopWhatsApp } from '../../../components/ShopWhatsApp';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreGrid } from '../../../components/StoreGrid';
import { SellerReviews } from '../../../components/SellerReviews';
import { EmptyState, Rating, VerifiedBadge, ProBadge } from '../../../components/ui';
import { IconBox } from '../../../components/icons';
import {
  getShopDetail,
  getVendorReviews,
  listProductsByVendor,
  type VendorReviewList,
} from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Title, description and share card for a shop page (WEB-02).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopDetail(slug).catch(() => null);
  if (!shop) return { title: 'Loja · Nhonga' };
  const where = shop.location ? ` em ${shop.location}` : '';
  const title = `${shop.displayName} — Loja no Nhonga`;
  const description = `${shop.activeCount} anúncios de ${shop.displayName}${where}. Veja os produtos e contacte o vendedor no Nhonga.`;
  const url = `/loja/${encodeURIComponent(slug)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile' },
    twitter: { card: 'summary', title, description },
  };
}

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

  let reviews: VendorReviewList = { items: [], summary: { ratingAvg: null, ratingCount: 0 } };
  if (vendor) reviews = await getVendorReviews(vendor.id);

  const shop = await getShopDetail(slug);
  const memberSince = shop
    ? new Date(shop.memberSince).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' })
    : null;

  const name = vendor?.displayName ?? slug;
  const count = items.length;
  const countLabel =
    count === 1 ? t.seller.one_product : t.seller.n_products.replace('{n}', String(count));

  const ratingAvg = reviews.summary.ratingAvg ?? vendor?.ratingAvg ?? null;

  return (
    <>
      <div className="store__banner" aria-hidden="true" />
      <header className="store">
        <span className="store__avatar" aria-hidden="true">
          {name.charAt(0)}
        </span>
        <div className="store__meta">
          <h1 className="store__name">
            {name}
            {vendor?.isVerified ? <VerifiedBadge label={t.seller.verified} /> : null}
            {vendor?.isPro ? <ProBadge label={t.common.pro} /> : null}
          </h1>
          <div className="store__stats">
            {ratingAvg !== null ? (
              <Rating value={ratingAvg} count={reviews.summary.ratingCount} />
            ) : null}
            <span className="store__count">{countLabel}</span>
          </div>
          {shop && (shop.location || memberSince) ? (
            <p className="store__sub">
              {shop.location ? <span>{shop.location}</span> : null}
              {shop.location && memberSince ? <span aria-hidden="true"> · </span> : null}
              {memberSince ? (
                <span>
                  {t.seller.member_since} {memberSince}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="store__cta">
          {shop?.contact?.whatsapp ? (
            <ShopWhatsApp
              vendorSlug={slug}
              label={t.seller.contact_whatsapp}
              failed={t.contact.reveal_failed}
              limited={t.contact.reveal_limited}
            />
          ) : null}
          <a
            className="btn btn--ghost store__contact"
            href={`/mensagens/novo?loja=${encodeURIComponent(slug)}&nome=${encodeURIComponent(name)}`}
          >
            {t.messages.contact_seller}
          </a>
        </div>
      </header>

      <ul className="storestats">
        <li className="storestat">
          <strong>{count}</strong>
          <span>{t.seller.stat_listings}</span>
        </li>
        {shop && shop.soldCount > 0 ? (
          <li className="storestat">
            <strong>{shop.soldCount}</strong>
            <span>{t.seller.stat_sold}</span>
          </li>
        ) : null}
        <li className="storestat">
          <strong>{ratingAvg !== null ? ratingAvg.toFixed(1) : '—'}</strong>
          <span>{t.seller.stat_rating}</span>
        </li>
        <li className="storestat">
          <strong>{reviews.summary.ratingCount}</strong>
          <span>{t.seller.stat_reviews}</span>
        </li>
        {vendor?.isVerified ? (
          <li className="storestat storestat--ok">
            <strong>✓</strong>
            <span>{t.seller.stat_verified}</span>
          </li>
        ) : null}
      </ul>

      {count === 0 ? (
        <section className="section" aria-label={t.seller.products}>
          <EmptyState icon={<IconBox />}>{t.seller.no_products}</EmptyState>
        </section>
      ) : (
        <StoreGrid items={items} t={t} />
      )}

      {vendor ? <SellerReviews vendorId={vendor.id} initial={reviews} t={t.reviews} /> : null}
    </>
  );
}
