import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cents, formatMZN } from '@nhonga/shared';
import { Price, Rating, VerifiedBadge, ProBadge } from '../../../components/ui';
import { IconTruck, IconCheck, IconShield } from '../../../components/icons';
import { getCategoryAttributes, getProduct, type ProductDetail } from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';
import { ContactSeller } from '../../../components/ContactSeller';
import { ReportListing } from '../../../components/ReportListing';

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

  const hero = product.images[0] ?? product.image;

  // Human labels for the attribute keys (marca → "Marca"), from the category's
  // own attribute definitions. Falls back to the raw key if a label is missing.
  const catSlug = product.category?.slug;
  const attrDefs = catSlug ? await getCategoryAttributes(catSlug) : [];
  const labelOf = new Map(attrDefs.map((a) => [a.key, a.label]));
  const specs = Object.entries(product.attributes);

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

      <div className="pdp__layout">
        <div>
          <div className="pdp__hero">
            {hero ? (
              <Image
                src={hero.url}
                alt={hero.alt ?? product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                style={{ objectFit: 'cover' }}
              />
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <div className="pdp__thumbs">
              {product.images.map((img, i) => (
                <span className="pdp__thumb" key={i}>
                  <Image
                    src={img.url}
                    alt={img.alt ?? ''}
                    width={56}
                    height={56}
                    style={{ objectFit: 'cover' }}
                  />
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pdp__body">
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
          />

          <ul className="assurances">
            <li className="assurance">
              <IconTruck width={20} height={20} />
              <span className="assurance__body">
                <strong>{t.pdp.info_delivery}</strong>
                <span>{t.pdp.info_delivery_desc}</span>
              </span>
            </li>
            <li className="assurance">
              <IconCheck width={20} height={20} />
              <span className="assurance__body">
                <strong>{t.pdp.info_returns}</strong>
                <span>{t.pdp.info_returns_desc}</span>
              </span>
            </li>
            <li className="assurance">
              <IconShield width={20} height={20} />
              <span className="assurance__body">
                <strong>{t.pdp.info_protection}</strong>
                <span>{t.pdp.info_protection_desc}</span>
              </span>
            </li>
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
    </article>
  );
}
