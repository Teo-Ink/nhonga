'use client';
import { use, useEffect, useState } from 'react';
import { pt } from '../../../../../lib/i18n/pt';
import { IconChevronLeft } from '../../../../../components/icons';
import { PhotoUpload } from '../../../../../components/PhotoUpload';

const CATEGORY_KEYS = [
  'viaturas',
  'imoveis',
  'empregos',
  'servicos',
  'eventos',
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

interface Detail {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  description: string;
  category: { slug: string };
  images: { url: string }[];
}

// Edit one of the seller's own listings. Prefills from the product detail and
// PATCHes /api/listings/:id (ownership checked server-side). Photos support the
// same add/remove/reorder as the create form — existing photos are kept as URLs.
export default function EditListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = pt.sell;
  const cats = pt.categories;

  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch(`/api/product/${slug}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Detail | null) => {
        if (!d) return;
        setId(d.id);
        setTitle(d.title);
        setCategory(d.category?.slug ?? '');
        setDescription(d.description ?? '');
        setPrice(String(Math.round(d.priceCents / 100)));
        setPhotos((d.images ?? []).map((i) => i.url).filter((u) => !u.startsWith('/ph')));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [slug]);

  const priceNum = Number(price.replace(',', '.'));
  const valid = title.trim() !== '' && category !== '' && Number.isFinite(priceNum) && priceNum > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    if (!valid || !id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim(),
          priceCents: Math.round(priceNum * 100),
          photos,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { slug?: string };
      if (!res.ok || !data.slug) {
        setError(true);
        return;
      }
      window.location.href = `/produto/${data.slug}`;
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <section className="newlisting">
        <p className="account__muted">{t.edit_loading}</p>
      </section>
    );
  }

  return (
    <section className="newlisting">
      <a className="pdp__back" href="/vender">
        <IconChevronLeft /> {t.back_dash}
      </a>
      <h1 className="section__title">{t.edit_title}</h1>

      <form className="card newlisting__form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span className="field__label">{t.f_title}</span>
          <input
            className="field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.f_title_ph}
          />
        </label>

        <label className="field">
          <span className="field__label">{t.f_category}</span>
          <select
            className="field__input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t.f_category_ph}</option>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {cats[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">{t.f_description}</span>
          <textarea
            className="field__input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.f_description_ph}
          />
        </label>

        <label className="field">
          <span className="field__label">{t.f_price}</span>
          <input
            className="field__input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="450"
            inputMode="numeric"
          />
        </label>

        <div className="field">
          <span className="field__label">{t.f_photos}</span>
          <PhotoUpload
            photos={photos}
            onChange={setPhotos}
            max={6}
            labels={{
              add: t.f_photos_add,
              hint: t.f_photos_hint,
              cover: t.f_photos_cover,
              makeCover: t.f_photos_makecover,
              remove: t.f_photos_remove,
              count: (n, m) =>
                t.f_photos_count.replace('{n}', String(n)).replace('{max}', String(m)),
            }}
          />
        </div>

        <button type="submit" className="btn btn--cta auth__submit" disabled={saving || !valid}>
          {saving ? t.edit_saving : t.edit_save}
        </button>
        {error ? (
          <p className="field__error" role="alert">
            {t.edit_error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
