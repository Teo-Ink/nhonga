import { Price, Rating, DealBadge, VerifiedBadge, Skeleton, EmptyState } from '../../components/ui';
import { IconBox, IconShield } from '../../components/icons';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Design-system showcase — the visual handoff reference. Swatches are painted
// with the real CSS variables (never a copied hex), so this page can never
// drift from tokens.css. Fixed colour scales list their hex; semantic roles do
// not, because they intentionally change between light and dark.
type Swatch = { token: string; hex?: string };

const PRIMARY: Swatch[] = [
  { token: '--color-primary-50', hex: '#e8f2ec' },
  { token: '--color-primary-100', hex: '#cbe3d5' },
  { token: '--color-primary-200', hex: '#9fcbb0' },
  { token: '--color-primary-300', hex: '#66ac86' },
  { token: '--color-primary-400', hex: '#2f9a68' },
  { token: '--color-primary-500', hex: '#12855c' },
  { token: '--color-primary-600', hex: '#0e6b4a' },
  { token: '--color-primary-700', hex: '#0b5138' },
  { token: '--color-primary-800', hex: '#083c2a' },
  { token: '--color-primary-900', hex: '#05281c' },
];
const ACCENT: Swatch[] = [
  { token: '--color-accent-50', hex: '#fbede7' },
  { token: '--color-accent-100', hex: '#f6d6c8' },
  { token: '--color-accent-200', hex: '#edb49c' },
  { token: '--color-accent-300', hex: '#e18f6d' },
  { token: '--color-accent-400', hex: '#d5734a' },
  { token: '--color-accent-500', hex: '#c0562e' },
  { token: '--color-accent-600', hex: '#b0491f' },
  { token: '--color-accent-700', hex: '#8f3a18' },
];
const AMBER: Swatch[] = [
  { token: '--color-amber-400', hex: '#f0b429' },
  { token: '--color-amber-500', hex: '#e8a317' },
  { token: '--color-amber-700', hex: '#8a6d00' },
];
const NEUTRAL: Swatch[] = [
  { token: '--color-neutral-0', hex: '#ffffff' },
  { token: '--color-neutral-25', hex: '#faf7f2' },
  { token: '--color-neutral-100', hex: '#ede7dd' },
  { token: '--color-neutral-200', hex: '#ded6c8' },
  { token: '--color-neutral-400', hex: '#a99e8c' },
  { token: '--color-neutral-600', hex: '#6e6456' },
  { token: '--color-neutral-800', hex: '#3a352c' },
  { token: '--color-neutral-900', hex: '#2b2620' },
];
const SEMANTIC: Swatch[] = [
  { token: '--bg' },
  { token: '--surface' },
  { token: '--surface-sunken' },
  { token: '--border' },
  { token: '--brand' },
  { token: '--cta' },
  { token: '--rating' },
  { token: '--focus-ring' },
];

const TYPE_SCALE = [
  { token: '--text-3xl', label: '32 / 3xl' },
  { token: '--text-2xl', label: '24 / 2xl' },
  { token: '--text-xl', label: '20 / xl' },
  { token: '--text-lg', label: '18 / lg' },
  { token: '--text-base', label: '16 / base' },
  { token: '--text-sm', label: '14 / sm' },
  { token: '--text-xs', label: '12 / xs' },
];

function SwatchRow({ items, showHex }: { items: Swatch[]; showHex?: boolean }) {
  return (
    <div className="swatchrow">
      {items.map((s) => (
        <div className="swatch" key={s.token}>
          <span className="swatch__chip" style={{ background: `var(${s.token})` }} />
          <span className="swatch__token">{s.token.replace('--', '')}</span>
          {showHex && s.hex ? <span className="swatch__hex">{s.hex}</span> : null}
        </div>
      ))}
    </div>
  );
}

export default async function StyleGuidePage() {
  const { t } = await getDictionary();
  const s = t.style;

  return (
    <section className="ds">
      <header className="ds__head">
        <h1 className="section__title">{s.title}</h1>
        <p className="ds__subtitle">{s.subtitle}</p>
        <p className="ds__note">
          <IconShield width={16} height={16} /> {s.contrast_note}
        </p>
      </header>

      {/* Colours */}
      <h2 className="ds__h2">{s.colors}</h2>
      <div className="ds__block">
        <h3 className="ds__h3">{s.primary}</h3>
        <SwatchRow items={PRIMARY} showHex />
        <h3 className="ds__h3">{s.accent}</h3>
        <SwatchRow items={ACCENT} showHex />
        <h3 className="ds__h3">{s.amber}</h3>
        <SwatchRow items={AMBER} showHex />
        <h3 className="ds__h3">{s.neutral}</h3>
        <SwatchRow items={NEUTRAL} showHex />
        <h3 className="ds__h3">{s.semantic}</h3>
        <SwatchRow items={SEMANTIC} />
      </div>

      {/* Typography */}
      <h2 className="ds__h2">{s.typography}</h2>
      <div className="ds__block">
        {TYPE_SCALE.map((ts) => (
          <div className="typerow" key={ts.token}>
            <span className="typerow__label">{ts.label}</span>
            <span style={{ fontSize: `var(${ts.token})`, fontWeight: 600 }}>
              Compre e venda em Moçambique
            </span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <h2 className="ds__h2">{s.buttons}</h2>
      <div className="ds__block ds__row">
        <button className="btn btn--cta" style={{ maxWidth: 200 }}>
          {t.pdp.add_to_cart}
        </button>
        <button className="btn btn--primary" style={{ maxWidth: 200 }}>
          {t.cart.checkout}
        </button>
        <button className="btn btn--ghost" style={{ maxWidth: 200 }}>
          {t.common.see_all}
        </button>
      </div>

      {/* Badges */}
      <h2 className="ds__h2">{s.badges}</h2>
      <div className="ds__block ds__row">
        <DealBadge percent={25} />
        <VerifiedBadge label={t.common.verified} />
        <span className="badge badge--soldout">{t.common.sold_out}</span>
        <Rating value={4.8} count={41} />
      </div>

      {/* Forms */}
      <h2 className="ds__h2">{s.forms}</h2>
      <div className="ds__block" style={{ maxWidth: 420 }}>
        <label className="field">
          <span className="field__label">{s.sample_input}</span>
          <input className="field__input" placeholder="Placeholder" />
        </label>
        <label className="field">
          <span className="field__label">{t.checkout.province_label}</span>
          <select className="field__input" defaultValue="">
            <option value="">{t.checkout.province_ph}</option>
            <option>Maputo Cidade</option>
          </select>
        </label>
      </div>

      {/* Product card + price */}
      <h2 className="ds__h2">{s.cards}</h2>
      <div className="ds__block ds__row">
        <div className="card" style={{ maxWidth: 200 }}>
          <div className="card__media">
            <DealBadge percent={25} />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <IconBox />
            </span>
          </div>
          <div className="card__body">
            <span className="card__title">{s.cards}</span>
            <Price now={45000} was={60000} />
            <span className="card__vendor">
              <Rating value={4.8} />
            </span>
          </div>
        </div>
      </div>

      {/* States */}
      <h2 className="ds__h2">{s.states}</h2>
      <div className="ds__block">
        <h3 className="ds__h3">{s.state_skeleton}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
          <Skeleton w="70%" h={16} />
          <Skeleton w="40%" h={16} />
          <Skeleton w="90%" h={16} />
        </div>
        <h3 className="ds__h3">{s.state_empty}</h3>
        <EmptyState icon={<IconBox />}>{t.search.no_results_body}</EmptyState>
      </div>
    </section>
  );
}
