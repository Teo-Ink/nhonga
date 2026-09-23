'use client';
import { useState } from 'react';
import { isValidMzMsisdn } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import { IconCheck } from '../../../components/icons';

// Seller onboarding wizard. Shop creation is not wired: finishing persists
// nothing and shows an honest "not available in this demo" message. Real
// Mozambican provinces are geographic facts, not demo data.
const PROVINCES = [
  'Maputo Cidade',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa',
] as const;

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

const TOTAL = 3;

export default function OnboardingPage() {
  const t = pt.onboard;
  const cats = pt.categories;

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [type, setType] = useState<'individual' | 'company'>('individual');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');

  const phoneValid = isValidMzMsisdn(phone);
  const stepValid =
    step === 0
      ? storeName.trim() !== '' && category !== ''
      : step === 1
        ? name.trim() !== '' && phoneValid
        : province !== '' && district.trim() !== '';

  function next() {
    setSubmitted(true);
    if (!stepValid) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSubmitted(false);
    if (step < TOTAL - 1) setStep(step + 1);
    else setDone(true);
  }

  // MercadoLivre-style vertical step rail: the data steps plus a final review.
  const railSteps = [t.s1_title, t.s2_title, t.s3_title, t.rail_review];
  const help = [t.help1, t.help2, t.help3][step];
  const activeRail = done ? 3 : step;

  if (done) {
    return (
      <section className="onboard">
        <div className="confirm__hero">
          <span className="confirm__check" aria-hidden="true">
            <IconCheck width={26} height={26} />
          </span>
          <h1 className="section__title">{t.review_title}</h1>
          <p className="account__muted">{t.review_body}</p>
        </div>
        <div className="card">
          <ul className="reviewlist">
            <li>
              <span>{t.store_name}</span>
              <strong>{storeName}</strong>
            </li>
            <li>
              <span>{t.type}</span>
              <strong>{type === 'individual' ? t.type_individual : t.type_company}</strong>
            </li>
            <li>
              <span>{t.main_category}</span>
              <strong>{cats[category as (typeof CATEGORY_KEYS)[number]]}</strong>
            </li>
            <li>
              <span>{t.full_name}</span>
              <strong>{name}</strong>
            </li>
            <li>
              <span>{t.phone}</span>
              <strong>{phone}</strong>
            </li>
            <li>
              <span>{t.s3_title}</span>
              <strong>
                {district}, {province}
              </strong>
            </li>
          </ul>
          <p className="auth__notice" role="status" style={{ marginTop: 'var(--space-3)' }}>
            {t.not_wired}
          </p>
          <a
            className="btn btn--cta auth__submit"
            href="/vender"
            style={{ marginTop: 'var(--space-2)' }}
          >
            {t.go_dashboard}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="onboard onboard--ml">
      <header className="onboard__head">
        <h1 className="section__title">{t.title}</h1>
        <p className="account__muted">{t.subtitle}</p>
        <p className="demo-banner" role="note" style={{ marginTop: 'var(--space-2)' }}>
          {t.demo_note}
        </p>
      </header>

      <div className="onboard__cols">
        {/* Vertical step rail (MercadoLivre-style) */}
        <ol
          className="mlrail"
          aria-label={t.step.replace('{n}', String(step + 1)).replace('{total}', String(TOTAL))}
        >
          {railSteps.map((label, i) => (
            <li
              key={label}
              className={`mlrail__step ${i === activeRail ? 'is-active' : ''} ${i < activeRail ? 'is-done' : ''}`}
              aria-current={i === activeRail ? 'step' : undefined}
            >
              <span className="mlrail__no" aria-hidden="true">
                {i < activeRail ? <IconCheck width={15} height={15} /> : i + 1}
              </span>
              <span className="mlrail__label">{label}</span>
            </li>
          ))}
        </ol>

        <div className="onboard__main">
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            noValidate
          >
            {step === 0 ? (
              <>
                <h2 className="card__title">{t.s1_title}</h2>
                <label className="field">
                  <span className="field__label">
                    {t.store_name} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t.store_name_ph}
                    aria-invalid={submitted && storeName.trim() === ''}
                  />
                </label>
                <div className="field">
                  <span className="field__label">{t.type}</span>
                  <div className="radio-cards">
                    <label
                      className={`radio-card ${type === 'individual' ? 'radio-card--on' : ''}`}
                    >
                      <input
                        type="radio"
                        name="type"
                        checked={type === 'individual'}
                        onChange={() => setType('individual')}
                      />
                      <span className="radio-card__title">{t.type_individual}</span>
                    </label>
                    <label className={`radio-card ${type === 'company' ? 'radio-card--on' : ''}`}>
                      <input
                        type="radio"
                        name="type"
                        checked={type === 'company'}
                        onChange={() => setType('company')}
                      />
                      <span className="radio-card__title">{t.type_company}</span>
                    </label>
                  </div>
                </div>
                <label className="field">
                  <span className="field__label">
                    {t.main_category} <span aria-hidden="true">*</span>
                  </span>
                  <select
                    className="field__input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-invalid={submitted && category === ''}
                  >
                    <option value="">{t.category_ph}</option>
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {cats[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : step === 1 ? (
              <>
                <h2 className="card__title">{t.s2_title}</h2>
                <label className="field">
                  <span className="field__label">
                    {t.full_name} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.full_name_ph}
                    autoComplete="name"
                    aria-invalid={submitted && name.trim() === ''}
                  />
                </label>
                <label className="field">
                  <span className="field__label">
                    {t.phone} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phone_ph}
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={submitted && !phoneValid}
                    aria-describedby="ob-phone-err"
                  />
                  {submitted && !phoneValid ? (
                    <span className="field__error" id="ob-phone-err" role="alert">
                      {t.phone_invalid}
                    </span>
                  ) : null}
                </label>
              </>
            ) : (
              <>
                <h2 className="card__title">{t.s3_title}</h2>
                <label className="field">
                  <span className="field__label">
                    {t.province} <span aria-hidden="true">*</span>
                  </span>
                  <select
                    className="field__input"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    aria-invalid={submitted && province === ''}
                  >
                    <option value="">{t.province_ph}</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">
                    {t.district} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder={t.district_ph}
                    aria-invalid={submitted && district.trim() === ''}
                  />
                </label>
              </>
            )}

            {help ? (
              <p className="onboard__help" role="note">
                {help}
              </p>
            ) : null}

            <div className="onboard__nav">
              {step > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setSubmitted(false);
                    setStep(step - 1);
                  }}
                >
                  {t.back}
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="btn btn--cta">
                {step < TOTAL - 1 ? t.next : t.finish}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
