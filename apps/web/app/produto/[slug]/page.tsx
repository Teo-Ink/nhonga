import { notFound } from 'next/navigation';
import { cents, formatMZN } from '@nhonga/shared';
import { getProduct, type ProductDetail } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let product: ProductDetail;
  try {
    product = await getProduct(slug);
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) notFound();
    throw e;
  }

  const hero = product.images[0] ?? product.image;

  return (
    <article className="pdp">
      <a className="back" href="/">
        ← Voltar
      </a>

      <div className="pdp__hero">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.url} alt={hero.alt ?? product.title} />
        ) : null}
      </div>

      <div className="pdp__body">
        <h1 className="pdp__title">{product.title}</h1>

        <div className="pdp__price price">
          <span className="price__now">{formatMZN(cents(product.priceCents))}</span>
          {product.compareAtCents ? (
            <span className="price__was">{formatMZN(cents(product.compareAtCents))}</span>
          ) : null}
          {product.discountPercent ? (
            <span className="badge" style={{ position: 'static' }}>
              -{product.discountPercent}%
            </span>
          ) : null}
        </div>

        <div className="vendorline">
          <span>Vendido por {product.vendor.displayName}</span>
          {product.vendor.isVerified ? <span className="verified">✓ Verificado</span> : null}
          {product.ratingAvg ? (
            <span className="rating">★ {product.ratingAvg.toFixed(1)}</span>
          ) : null}
        </div>

        {product.options.map((group) => (
          <div key={group.name} className="optgroup">
            <span className="optgroup__label">{group.name}</span>
            <div className="chips">
              {group.values.map((v) => (
                <span
                  key={v.value}
                  className={v.available ? 'chip' : 'chip chip--off'}
                  title={v.available ? undefined : 'Indisponível'}
                >
                  {v.value}
                </span>
              ))}
            </div>
          </div>
        ))}

        {product.description ? <p className="desc">{product.description}</p> : null}

        <button className="cta" disabled={!product.inStock}>
          {product.inStock ? 'Adicionar ao carrinho (em breve)' : 'Esgotado'}
        </button>
        <p className="notice">
          Ambiente de teste · o botão de compra está desativado até o checkout ser ligado.
        </p>
      </div>
    </article>
  );
}
