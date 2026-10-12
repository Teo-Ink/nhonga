'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN, fromMeticais } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import {
  IconChevronLeft,
  IconBox,
  IconSparkle,
  IconMic,
  IconCamera,
} from '../../../components/icons';
import { PhotoUpload } from '../../../components/PhotoUpload';
import { useSession } from '../../../components/auth/SessionProvider';

// Create listing — fully wired. The form POSTs to /api/listings (real
// createListing under the signed-in seller's shop); photos are picked and
// compressed in the browser, uploaded as data URLs and served from
// /api/media/:id; a paid plan boosts the fresh listing. A live preview mirrors
// the form as you type.
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

export default function NewListingPage() {
  const t = pt.sell;
  const cats = pt.categories;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [plan, setPlan] = useState<'free' | 'destaque' | 'turbo'>('free');
  const [photos, setPhotos] = useState<string[]>([]);
  const { user, loading: sessionLoading } = useSession();
  const [shop, setShop] = useState<{ slug: string; displayName: string } | null>(null);
  const [shopChecked, setShopChecked] = useState(false);
  const [shopName, setShopName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error' | 'unconfigured'>('idle');
  const [photoAiState, setPhotoAiState] = useState<'idle' | 'loading' | 'error' | 'unconfigured'>(
    'idle',
  );
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'unsupported'>('idle');

  // Draft title + description + category from the first uploaded photo (vision).
  async function analyzePhoto() {
    const image = photos[0];
    if (!image) return;
    setPhotoAiState('loading');
    try {
      const res = await fetch('/api/assistant/listing-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, notes: aiNotes.trim() || undefined }),
      });
      const data = (await res.json()) as {
        title?: string;
        description?: string;
        category?: string;
        configured?: boolean;
      };
      if (!res.ok) {
        setPhotoAiState('error');
        return;
      }
      if (!data.configured) {
        setPhotoAiState('unconfigured');
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.category && (CATEGORY_KEYS as readonly string[]).includes(data.category)) {
        setCategory(data.category);
      }
      setPhotoAiState('idle');
    } catch {
      setPhotoAiState('error');
    }
  }

  // Dictate the notes by voice (Web Speech API, Chrome/Edge). The transcript is
  // appended to the notes so the seller can then "write with AI" from speech.
  function startVoice() {
    type SR = {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'pt-PT';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
      setAiNotes((prev) => (prev ? `${prev} ${text}` : text).trim());
    };
    rec.onerror = () => setVoiceState('idle');
    rec.onend = () => setVoiceState('idle');
    setVoiceState('listening');
    rec.start();
  }

  async function generate() {
    if (aiNotes.trim().length < 3) return;
    setAiState('loading');
    try {
      const res = await fetch('/api/assistant/listing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, details: aiNotes }),
      });
      const data = (await res.json()) as {
        title?: string;
        description?: string;
        configured?: boolean;
      };
      if (!res.ok) {
        setAiState('error');
        return;
      }
      if (!data.configured) {
        setAiState('unconfigured');
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      setAiState('idle');
    } catch {
      setAiState('error');
    }
  }

  const plans = [
    { id: 'free' as const, name: t.plan_free, desc: t.plan_free_desc },
    { id: 'destaque' as const, name: t.plan_destaque, desc: t.plan_destaque_desc },
    { id: 'turbo' as const, name: t.plan_turbo, desc: t.plan_turbo_desc },
  ];

  // Does the signed-in seller already have a shop? If not, they name it here.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setShopChecked(true);
      return;
    }
    void fetch('/api/mine/shop', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { slug: string; displayName: string } | null) => setShop(d))
      .catch(() => setShop(null))
      .finally(() => setShopChecked(true));
  }, [user, sessionLoading]);

  const needsShopName = !!user && shopChecked && !shop;

  const priceNum = Number(price.replace(',', '.'));
  const priceValid = price.trim() !== '' && Number.isFinite(priceNum) && priceNum > 0;
  const valid =
    title.trim() !== '' &&
    category !== '' &&
    priceValid &&
    (!needsShopName || shopName.trim().length >= 2);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setPubError(false);
    if (!valid) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim(),
          priceCents: Math.round(priceNum * 100),
          stock: Number(stock.replace(/\D/g, '')) || 1,
          photos,
          ...(needsShopName && shopName.trim() ? { shopName: shopName.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { slug?: string };
      if (!res.ok || !data.slug) {
        setPubError(true);
        return;
      }
      // A paid plan boosts the fresh listing (mock payment), like /vender/promover.
      if (plan !== 'free') {
        await fetch('/api/promotions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productSlug: data.slug, planCode: plan, paymentMethod: 'mpesa' }),
        }).catch(() => undefined);
      }
      window.location.href = `/produto/${data.slug}`;
    } catch {
      setPubError(true);
    } finally {
      setPublishing(false);
    }
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
          {/* Seller identity: name the shop on the first listing (onboarding). */}
          {shopChecked ? (
            needsShopName ? (
              <label className="field">
                <span className="field__label">{t.shop_label}</span>
                <input
                  className="field__input"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t.shop_name_ph}
                  aria-invalid={submitted && shopName.trim().length < 2}
                />
                <span className="field__hint">{t.shop_hint}</span>
              </label>
            ) : (
              <p className="newlisting__as" role="note">
                {t.publishing_as} <strong>{shop ? shop.displayName : t.shop_community}</strong>
                {!user ? (
                  <>
                    {' · '}
                    <a href="/entrar">{t.shop_login}</a>
                  </>
                ) : null}
              </p>
            )
          ) : null}

          <div className="aihelper">
            <div className="aihelper__head">
              <IconSparkle width={18} height={18} />
              <strong>{t.ai_title}</strong>
            </div>
            <p className="aihelper__hint">{t.ai_hint}</p>
            <div className="aihelper__inputwrap">
              <textarea
                className="field__input"
                rows={2}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder={t.ai_ph}
              />
              <button
                type="button"
                className={`aihelper__mic ${voiceState === 'listening' ? 'is-on' : ''}`}
                onClick={startVoice}
                disabled={voiceState === 'listening'}
                aria-label={t.voice}
                title={t.voice}
              >
                <IconMic width={18} height={18} />
              </button>
            </div>
            {voiceState === 'listening' ? (
              <p className="aihelper__note" role="status">
                {t.voice_listening}
              </p>
            ) : null}
            {voiceState === 'unsupported' ? (
              <p className="aihelper__note" role="status">
                {t.voice_unsupported}
              </p>
            ) : null}
            <div className="aihelper__actions">
              <button
                type="button"
                className="btn btn--ghost aihelper__btn"
                onClick={generate}
                disabled={aiState === 'loading' || aiNotes.trim().length < 3}
              >
                <IconSparkle width={16} height={16} />
                {aiState === 'loading' ? t.ai_loading : t.ai_generate}
              </button>
              <button
                type="button"
                className="btn btn--ghost aihelper__btn"
                onClick={analyzePhoto}
                disabled={photoAiState === 'loading' || photos.length === 0}
              >
                <IconCamera width={16} height={16} />
                {photoAiState === 'loading' ? t.ai_photo_loading : t.ai_photo}
              </button>
            </div>
            {photos.length === 0 ? (
              <p className="aihelper__note" role="status">
                {t.ai_photo_hint}
              </p>
            ) : null}
            {aiState === 'unconfigured' || photoAiState === 'unconfigured' ? (
              <p className="aihelper__note" role="status">
                {t.ai_unconfigured}
              </p>
            ) : null}
            {aiState === 'error' || photoAiState === 'error' ? (
              <p className="aihelper__note aihelper__note--err" role="alert">
                {t.ai_error}
              </p>
            ) : null}
          </div>

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

          {/* Listing plan (MercadoLivre-style step; Gumtree-style boosts) */}
          <div className="field">
            <span className="field__label-row">
              <span className="field__label">{t.plan_title}</span>
              <a className="field__link" href="/vender/planos">
                {t.plan_see_all} →
              </a>
            </span>
            <div className="planpick">
              {plans.map((pl) => (
                <label key={pl.id} className={`planpick__opt ${plan === pl.id ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name="plan"
                    checked={plan === pl.id}
                    onChange={() => setPlan(pl.id)}
                  />
                  <span className="planpick__name">{pl.name}</span>
                  <span className="planpick__desc">{pl.desc}</span>
                </label>
              ))}
            </div>
            <span className="field__hint">{t.plan_hint}</span>
          </div>

          <button type="submit" className="btn btn--cta auth__submit" disabled={publishing}>
            {publishing ? t.publishing : plan === 'free' ? t.publish_free : t.publish_paid}
          </button>

          {submitted && !valid ? (
            <p className="field__error" role="alert">
              {t.required}
            </p>
          ) : null}
          {pubError ? (
            <p className="field__error" role="alert">
              {t.publish_error}
            </p>
          ) : null}
        </form>

        {/* Live preview */}
        <aside className="newlisting__preview" aria-label={t.preview_title}>
          <h2 className="card__title">{t.preview_title}</h2>
          {title.trim() === '' && !previewPrice && photos.length === 0 ? (
            <p className="account__muted">{t.preview_empty}</p>
          ) : (
            <div className="card preview-card">
              <div className="card__media">
                {plan !== 'free' ? (
                  <span className="preview-card__badge">{t.badge_destaque}</span>
                ) : null}
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="" className="preview-card__cover" />
                ) : (
                  <span className="preview-card__ph" aria-hidden="true">
                    <IconBox />
                  </span>
                )}
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
