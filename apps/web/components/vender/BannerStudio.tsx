'use client';
import { useEffect, useState } from 'react';
import { useDict } from '../i18n/DictProvider';

interface Variant {
  id: string;
  preset: string;
  ratio: string;
}
interface Quota {
  used: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  pointCost: number;
}

const RATIOS = ['square', 'landscape', 'portrait'] as const;
const PRESETS = ['moderno', 'minimal', 'promocao', 'luxo', 'alegre', 'mercado'] as const;

// AI Banner Studio (web). The seller picks a format + style, optionally adds a
// prompt, and generates 3 variants composited server-side; one is applied to the
// listing. Quota + watermark state come from the API (wallet-backed).
export function BannerStudio({ productId }: { productId: string }) {
  const t = useDict().banner;
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>('square');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>('moderno');
  const [prompt, setPrompt] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    void fetch('/api/banners/quota', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((q: Quota | null) => setQuota(q))
      .catch(() => {});
  }, []);

  async function generate() {
    setBusy(true);
    setError('');
    setSelected(null);
    try {
      const res = await fetch('/api/banners/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, ratio, preset, prompt: prompt.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.code === 'quota' ? t.no_points : data?.message || t.error);
        return;
      }
      setVariants(data.variants ?? []);
      setSelected(data.variants?.[0]?.id ?? null);
      setAiUsed(Boolean(data.aiUsed));
      if (data.quota) setQuota(data.quota);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!selected) return;
    setApplying(true);
    setError('');
    try {
      const res = await fetch('/api/banners/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bannerId: selected }),
      });
      if (!res.ok) {
        setError(t.error);
        return;
      }
      setApplied(selected);
    } catch {
      setError(t.error);
    } finally {
      setApplying(false);
    }
  }

  const quotaLabel = quota?.isPro
    ? t.quota_pro
    : quota
      ? quota.remaining > 0
        ? t.quota_left.replace('{n}', String(quota.remaining))
        : t.quota_extra.replace('{n}', String(quota.pointCost))
      : '';

  return (
    <div className="bstudio">
      <div className="bstudio__head">
        <div>
          <h1 className="bstudio__title">{t.title}</h1>
          <p className="bstudio__sub">{t.subtitle}</p>
        </div>
        {quotaLabel ? <span className="bstudio__quota">{quotaLabel}</span> : null}
      </div>

      <div className="bstudio__controls">
        <fieldset className="bstudio__group">
          <legend>{t.ratio}</legend>
          <div className="bstudio__chips">
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                className={`bchip${ratio === r ? ' bchip--on' : ''}`}
                aria-pressed={ratio === r}
                onClick={() => setRatio(r)}
              >
                {t[`ratio_${r}` as const]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="bstudio__group">
          <legend>{t.style}</legend>
          <div className="bstudio__chips">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`bchip${preset === p ? ' bchip--on' : ''}`}
                aria-pressed={preset === p}
                onClick={() => setPreset(p)}
              >
                {t[`preset_${p}` as const]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="bstudio__group">
          <span className="bstudio__legend">{t.prompt_label}</span>
          <input
            className="field__input"
            value={prompt}
            maxLength={120}
            placeholder={t.prompt_ph}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>

        <button type="button" className="btn btn--cta bstudio__gen" onClick={generate} disabled={busy}>
          {busy ? t.generating : variants.length ? t.regenerate : t.generate}
        </button>
      </div>

      {error ? (
        <p className="bstudio__error" role="alert">
          {error}
        </p>
      ) : null}

      {variants.length > 0 ? (
        <>
          {aiUsed === false ? <p className="bstudio__note">{t.ai_offline}</p> : null}
          <p className="bstudio__hint">{t.pick_hint}</p>
          <div className={`bstudio__rail bstudio__rail--${ratio}`}>
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`bcard${selected === v.id ? ' bcard--on' : ''}`}
                aria-pressed={selected === v.id}
                onClick={() => setSelected(v.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="bcard__img" src={`/api/banners/${v.id}.svg`} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          <div className="bstudio__apply">
            <button
              type="button"
              className="btn btn--primary"
              onClick={apply}
              disabled={applying || !selected || applied === selected}
            >
              {applied === selected ? t.applied : applying ? t.applying : t.apply}
            </button>
            <span className="bstudio__wm">{quota?.isPro ? t.demo_note : t.watermark_note}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
