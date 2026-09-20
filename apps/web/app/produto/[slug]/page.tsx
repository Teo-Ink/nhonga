import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Price, Rating, VerifiedBadge } from '../../../components/ui';
import { IconChevronLeft, IconTruck } from '../../../components/icons';
import { getProduct, type ProductDetail } from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';
import { BuyBox } from '../../../components/cart/BuyBox';

export const dynamic = 'force-dynamic';

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
  const specs = Object.entries(product.attributes);

  return (
    <article className="pdp">
      <a className="pdp__back" href="/">
        <IconChevronLeft /> {t.common.back}
      </a>

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
              </span>
              <span className="seller__meta">
                <Rating value={product.ratingAvg} count={product.ratingCount} />
              </span>
            </span>
            <span className="seller__cta" aria-hidden="true">
              {t.seller.visit_store} →
            </span>
          </a>

          <BuyBox product={product} t={t} />

          <div className="deliv">
            <IconTruck width={18} height={18} />
            <span>
              {t.pdp.delivery_estimate}: <strong>{t.pdp.delivery_tbc}</strong>
            </span>
          </div>

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
                      <th scope="row">{k}</th>
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
        </div>
      </div>
    </article>
  );
}
