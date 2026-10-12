import type { Metadata } from 'next';
import { ProductGallery } from '../../../components/ProductGallery';
import { RecordRecentView } from '../../../components/RecentlyViewed';
import { notFound } from 'next/navigation';
import { cents, formatMZN } from '@nhonga/shared';
import { Price, Rating, VerifiedBadge, ProBadge } from '../../../components/ui';
import {
  IconTruck,
  IconCheck,
  IconShield,
  IconMapPin,
  IconWallet,
  IconStar,
} from '../../../components/icons';
import {
  getCategoryAttributes,
  getProduct,
  searchProducts,
  type ProductDetail,
} from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';
import { ProductCard } from '../../../components/ProductCard';
import { ContactSeller } from '../../../components/ContactSeller';
import { ReportListing } from '../../../components/ReportListing';
import { OwnerControls } from '../../../components/vender/OwnerControls';

export const dynamic = 'force-dynamic';

// Open Graph tags so a listing shared on WhatsApp shows a photo, title, price
// and city preview. Runs on the server; the image is the absolute /ph or CDN url.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await getProduct(slug);
    const price = formatMZN(cents(p.priceCents));
    const where = p.location ? ` · ${p.location}` : '';
    const title = `${p.title} — ${price}${where}`;
    const description = p.description?.slice(0, 160) || `${p.title} no Nhonga${where}`;
    const image = p.images[0]?.url ?? p.image?.url;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
    };
  } catch {
    return { title: 'Nhonga' };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getDictionary();

  let product: ProductDetail;
  try {
    product = await getProduct(slug);
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) notFound();
    throw e;
  }

  const galleryImages =
    product.images.length > 0 ? product.images : product.image ? [product.image] : [];

  // Human labels for the attribute keys (marca → "Marca"), from the category's
  // own attribute definitions. Falls back to the raw key if a label is missing.
  const catSlug = product.category?.slug;
  const attrDefs = catSlug ? await getCategoryAttributes(catSlug) : [];
  const labelOf = new Map(attrDefs.map((a) => [a.key, a.label]));
  const specs = Object.entries(product.attributes);

  // Other listings in the same category (classifieds "similar" rail).
  const similar = catSlug
    ? (await searchProducts({ category: catSlug })).items
        .filter((p) => p.id !== product.id)
        .slice(0, 6)
    : [];

  // Trust tips adapt to the listing's vertical (a job isn't "delivered"; a
  // property is visited; a service is agreed up front). Falls back to the
  // physical-goods default for the retail categories.
  const TIP_VERTICALS = ['viaturas', 'imoveis', 'empregos', 'servicos', 'eventos'] as const;
  const vertical = (TIP_VERTICALS as readonly string[]).includes(catSlug ?? '')
    ? (catSlug as (typeof TIP_VERTICALS)[number])
    : 'default';
  const tips = t.pdp.tips[vertical];
  const tipIcons: Record<string, (typeof IconShield)[]> = {
    default: [IconTruck, IconCheck, IconShield],
    viaturas: [IconTruck, IconCheck, IconShield],
    imoveis: [IconMapPin, IconCheck, IconShield],
    empregos: [IconCheck, IconShield, IconWallet],
    servicos: [IconCheck, IconWallet, IconStar],
    eventos: [IconCheck, IconShield, IconMapPin],
  };
  const icons = tipIcons[vertical] ?? tipIcons.default!;

  // Category-aware call-to-action: jobs "apply", services "request a quote".
  const ctaLabel =
    catSlug === 'empregos'
      ? t.contact.cta_apply
      : catSlug === 'servicos'
        ? t.contact.cta_quote
        : undefined;
  const waMessage =
    catSlug === 'empregos'
      ? t.contact.wa_apply
      : catSlug === 'servicos'
        ? t.contact.wa_quote
        : undefined;

  return (
    <article className="pdp">
      <RecordRecentView
        item={{
          slug: product.slug,
          title: product.title,
          image: galleryImages[0]?.url ?? null,
          priceCents: product.priceCents,
        }}
      />
      <nav className="crumbs" aria-label="breadcrumb">
        <span className="crumbs__item">
          <a href="/">{t.common.brand}</a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
        </span>
        <span className="crumbs__item">
          <a href={`/loja/${product.vendor.slug}`}>{product.vendor.displayName}</a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
        </span>
        <span className="crumbs__item">
          <span aria-current="page">{product.title}</span>
        </span>
      </nav>

      {product.bannerUrl ? (
        <div className="pdpbanner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pdpbanner__img" src={product.bannerUrl} alt={product.title} />
        </div>
      ) : null}

      <div className="pdp__layout">
        <div>
          <ProductGallery images={galleryImages} title={product.title} />
        </div>

        <div className="pdp__body">
          <OwnerControls productId={product.id} slug={slug} />
          <h1 className="pdp__title">{product.title}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Price now={product.priceCents} was={product.compareAtCents} large />
            {product.discountPercent ? (
              <span className="badge badge--deal">-{product.discountPercent}%</span>
            ) : null}
          </div>

          <a className="seller" href={`/loja/${product.vendor.slug}`}>
            <span className="seller__avatar" aria-hidden>
              {product.vendor.displayName.charAt(0)}
            </span>
            <span style={{ flex: 1 }}>
              <span className="seller__name">
                {product.vendor.displayName}
                {product.vendor.isVerified ? <VerifiedBadge label={t.common.verified} /> : null}
                {product.vendor.isPro ? <ProBadge label={t.common.pro} /> : null}
              </span>
              <span className="seller__meta">
                <Rating value={product.ratingAvg} count={product.ratingCount} />
              </span>
            </span>
            <span className="seller__cta" aria-hidden="true">
              {t.seller.visit_store} →
            </span>
          </a>

          <ContactSeller
            slug={product.slug}
            title={product.title}
            priceLabel={formatMZN(cents(product.priceCents))}
            whatsapp={product.vendor.whatsapp ?? null}
            phone={product.vendor.phone ?? null}
            t={t.contact}
            ctaLabel={ctaLabel}
            waMessage={waMessage}
            vendorSlug={product.vendor.slug}
            vendorName={product.vendor.displayName}
            safetyNote={t.contact.safety_tips[vertical]}
          />

          <ul className="assurances">
            {tips.map((tip, i) => {
              const Icon = icons[i] ?? IconShield;
              return (
                <li className="assurance" key={tip.t}>
                  <Icon width={20} height={20} />
                  <span className="assurance__body">
                    <strong>{tip.t}</strong>
                    <span>{tip.d}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {product.description ? <p className="desc">{product.description}</p> : null}

          {specs.length > 0 ? (
            <div>
              <h2 className="optgroup__label" style={{ marginBottom: 'var(--space-2)' }}>
                {t.pdp.specifications}
              </h2>
              <table className="specs">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{labelOf.get(k) ?? k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="notice" role="note">
            {t.pdp.demo_notice}
          </p>

          <ReportListing slug={product.slug} t={t.report} />
        </div>
      </div>

      {similar.length > 0 ? (
        <section className="pdpsimilar" aria-label={t.pdp.similar}>
          <h2 className="section__title">{t.pdp.similar}</h2>
          <div className="grid">
            {similar.map((p) => (
              <ProductCard key={p.id} p={p} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
