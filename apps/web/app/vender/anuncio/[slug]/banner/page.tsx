'use client';
import { use, useEffect, useState } from 'react';
import { IconChevronLeft } from '../../../../../components/icons';
import { useDict } from '../../../../../components/i18n/DictProvider';
import { BannerStudio } from '../../../../../components/vender/BannerStudio';

// Banner Studio page for one of the seller's own listings. Resolves the product
// id from the slug, then hands off to the studio (ownership is enforced by the
// API on every generate/apply call).
export default function BannerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useDict().banner;
  const sell = useDict().sell;
  const [productId, setProductId] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetch(`/api/product/${slug}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { id?: string } | null) => setProductId(d?.id ?? ''))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [slug]);

  return (
    <section className="newlisting">
      <a className="pdp__back" href={`/produto/${slug}`}>
        <IconChevronLeft /> {sell.back_dash}
      </a>
      {!loaded ? (
        <p className="account__muted">{sell.edit_loading}</p>
      ) : productId ? (
        <BannerStudio productId={productId} />
      ) : (
        <p className="account__muted">{t.signin}</p>
      )}
      <p className="notice" role="note">
        {t.demo_note}
      </p>
    </section>
  );
}
