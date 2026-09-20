import { cents, formatMZN } from '@nhonga/shared';
import { listProducts, type ProductListItem } from '../lib/api';

// Always render fresh against the live API in the local test env.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let products: ProductListItem[] = [];
  let error: string | null = null;
  try {
    products = await listProducts();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar produtos';
  }

  if (error) {
    return (
      <div className="empty">
        <p>Não foi possível carregar os produtos.</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return <div className="empty">Ainda não há produtos publicados.</div>;
  }

  return (
    <>
      <div className="grid">
        {products.map((p) => (
          <a key={p.id} className="card" href={`/produto/${p.slug}`}>
            <div className="card__imgwrap">
              {p.discountPercent ? <span className="badge">-{p.discountPercent}%</span> : null}
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="card__img" src={p.image.url} alt={p.image.alt ?? p.title} />
              ) : null}
            </div>
            <div className="card__body">
              <div className="card__title">{p.title}</div>
              <div className="price">
                <span className="price__now">{formatMZN(cents(p.priceCents))}</span>
                {p.compareAtCents ? (
                  <span className="price__was">{formatMZN(cents(p.compareAtCents))}</span>
                ) : null}
              </div>
              <div className="meta">
                {p.ratingAvg ? <span className="rating">★ {p.ratingAvg.toFixed(1)}</span> : null}
                <span>{p.vendor.displayName}</span>
                {p.vendor.isVerified ? <span className="verified">✓</span> : null}
                {!p.inStock ? <span className="oos">· Esgotado</span> : null}
              </div>
            </div>
          </a>
        ))}
      </div>
      <p className="notice">
        Ambiente de teste local · catálogo apenas para leitura. Checkout, contas e pagamentos ainda
        não estão ligados.
      </p>
    </>
  );
}
