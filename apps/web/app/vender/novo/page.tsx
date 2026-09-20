'use client';
import { useState } from 'react';
import { cents, formatMZN, fromMeticais } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft, IconBox } from '../../../components/icons';

// Create listing. Publishing is not wired (no seller auth, no create endpoint),
// so this is the correct form with a live preview, but "Publish" persists
// nothing and surfaces an honest "not available in this demo" message. Photo
// upload is deliberately disabled and labelled.
const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

export default function NewListingPage() {
  const t = pt.sell;
  const cats = pt.categories;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState(false);

  const priceNum = Number(price.replace(',', '.'));
  const priceValid = price.trim() !== '' && Number.isFinite(priceNum) && priceNum > 0;
  const valid = title.trim() !== '' && category !== '' && priceValid;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    // Deliberately does not publish. Nothing is persisted.
    setNotice(true);
  }

  const previewPrice = priceValid ? formatMZN(cents(fromMeticais(priceNum))) : null;

  return (
    <section className="newlisting">
      <a className="pdp__back" href="/vender">
        <IconChevronLeft /> {t.back_dash}
      </a>

      <h1 className="section__title">{t.new_title}</h1>
      <p className="account__muted">{t.new_subtitle}</p>

      <div className="newlisting__grid">
        <form className="card" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span className="field__label">
              {t.f_title} <span aria-hidden="true">*</span>
            </span>
            <input
              className="field__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.f_title_ph}
              aria-invalid={submitted && title.trim() === ''}
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t.f_category} <span aria-hidden="true">*</span>
            </span>
            <select
              className="field__input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-invalid={submitted && category === ''}
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
              className="field__input newlisting__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.f_description_ph}
              rows={4}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">
                {t.f_price} <span aria-hidden="true">*</span>
              </span>
              <input
                className="field__input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="450"
                inputMode="decimal"
                aria-invalid={submitted && !priceValid}
              />
            </label>
            <label className="field">
              <span className="field__label">{t.f_stock}</span>
              <input
                className="field__input"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="10"
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="field">
            <span className="field__label">{t.f_photos}</span>
            <button type="button" className="uploadbox" disabled aria-disabled="true">
              <IconBox />
              <span>{t.f_photos_add}</span>
            </button>
            <span className="field__hint">{t.f_photos_hint}</span>
          </div>

          <button type="submit" className="btn btn--cta auth__submit">
            {t.publish}
          </button>

          {submitted && !valid ? (
            <p className="field__error" role="alert">
              {t.required}
            </p>
          ) : null}
          {notice ? (
            <p className="auth__notice" role="alert">
              {t.not_wired}
            </p>
          ) : null}
        </form>

        {/* Live preview */}
        <aside className="newlisting__preview" aria-label={t.preview_title}>
          <h2 className="card__title">{t.preview_title}</h2>
          {title.trim() === '' && !previewPrice ? (
            <p className="account__muted">{t.preview_empty}</p>
          ) : (
            <div className="card preview-card">
              <div className="card__media">
                <span className="preview-card__ph" aria-hidden="true">
                  <IconBox />
                </span>
              </div>
              <div className="card__body">
                <span className="card__title">{title || t.f_title_ph}</span>
                {previewPrice ? <span className="price__now">{previewPrice}</span> : null}
                {category ? (
                  <span className="card__vendor">
                    {cats[category as (typeof CATEGORY_KEYS)[number]]}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
