import { IS_DEMO } from '../../../lib/demo';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ProductGallery } from '../../../components/ProductGallery';
import { RecordRecentView } from '../../../components/RecentlyViewed';
import { notFound } from 'next/navigation';
import { Rating, VerifiedBadge, ProBadge } from '../../../components/ui';
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
import { formatAttribute, formatListingPrice, formatPrice, keyFacts } from '../../../lib/format';
import { postedLabel } from '../../../components/ProductCard';
import { fill } from '../../../lib/i18n/index';

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
    const price = formatListingPrice(p.priceCents, p.category?.slug);
    const where = p.location ? ` · ${p.location}` : '';
    const title = `${p.title} — ${price}${where}`;
    const description = p.description?.slice(0, 160) || `${p.title} no Nhonga${where}`;
    // A designed banner makes a far better WhatsApp/Facebook card than the raw
    // photo. og:image must be a raster absolute URL, so use the banner's PNG.
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const origin = host ? `${proto}://${host}` : '';
    const rawImage = p.bannerUrl
      ? p.bannerUrl.replace(/\.svg$/i, '.png')
      : (p.images[0]?.url ?? p.image?.url);
    const image =
      rawImage && rawImage.startsWith('/') && origin ? `${origin}${rawImage}` : rawImage;
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
  // Closest in price first, so a 750.000 MT car suggests other cars around that
  // price rather than a 65.000 MT motorbike.
  const similar = catSlug
    ? (await searchProducts({ category: catSlug })).items
        .filter((p) => p.id !== product.id)
        .sort(
          (a, b) =>
            Math.abs(a.priceCents - product.priceCents) -
            Math.abs(b.priceCents - product.priceCents),
        )
        .slice(0, 6)
    : [];
  const locale = t.listing.locale;
  const facts = keyFacts(product.attributes, catSlug, locale, 4);
  const posted = postedLabel(product.postedAt, t.listing);
  const priceText = formatListingPrice(product.priceCents, catSlug, locale);

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
          <img className="pdpbanner__img" src={product.bannerUrl} alt={product.title} />
        </div>
      ) : null}

      {/* OLX-style ad page: gallery + details on the left, a sticky summary
          (title, price, key facts, contact, seller) on the right. On phones the
          grid areas reorder to gallery → summary → details. */}
      <div className="pdp__layout pdpx">
        <div className="pdpx__gallery">
          <ProductGallery images={galleryImages} title={product.title} />
        </div>

        <aside className="pdpx__side">
          <OwnerControls productId={product.id} slug={slug} />
          <p className="pdpx__meta">
            {product.location ? (
              <span className="pdpx__loc">
                <IconMapPin width={14} height={14} aria-hidden /> {product.location}
              </span>
            ) : null}
            {posted ? (
              <span>{fill(t.listing.published, { date: posted.toLowerCase() })}</span>
            ) : null}
          </p>
          <h1 className="pdp__title">{product.title}</h1>

          <div className="pdpx__price">
            <span className="price__now price__now--lg">{priceText}</span>
            {product.compareAtCents && product.compareAtCents > product.priceCents ? (
              <span className="price__was">{formatPrice(product.compareAtCents)}</span>
            ) : null}
            {product.discountPercent ? (
              <span className="badge badge--deal">-{product.discountPercent}%</span>
            ) : null}
          </div>

          {facts.length > 0 ? (
            <ul className="factchips" aria-label={t.pdp.specifications}>
              {facts.map((f) => (
                <li key={f} className="factchip">
                  {f}
                </li>
              ))}
            </ul>
          ) : null}

          <ContactSeller
            slug={product.slug}
            title={product.title}
            priceLabel={priceText}
            whatsapp={product.vendor.whatsapp ?? null}
            phone={product.vendor.phone ?? null}
            t={t.contact}
            ctaLabel={ctaLabel}
            waMessage={waMessage}
            vendorSlug={product.vendor.slug}
            vendorName={product.vendor.displayName}
            safetyNote={t.contact.safety_tips[vertical]}
          />

          <a className="seller" href={`/loja/${product.vendor.slug}`}>
            <span className="seller__avatar" aria-hidden>
              {product.vendor.displayName.charAt(0)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
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
              {t.contact.seller_all} →
            </span>
          </a>
        </aside>

        <div className="pdpx__details">
          {product.description ? (
            <section aria-labelledby="pdp-desc">
              <h2 className="pdpx__h2" id="pdp-desc">
                {t.pdp.description}
              </h2>
              <p className="desc">{product.description}</p>
            </section>
          ) : null}

          {specs.length > 0 ? (
            <section aria-labelledby="pdp-specs">
              <h2 className="pdpx__h2" id="pdp-specs">
                {t.pdp.specifications}
              </h2>
              <table className="specs">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{labelOf.get(k) ?? k}</th>
                      <td>{formatAttribute(k, v, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

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

          {IS_DEMO ? (
            <p className="notice" role="note">
              {t.pdp.demo_notice}
            </p>
          ) : null}

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
